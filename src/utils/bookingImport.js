import Papa from "papaparse";
import * as XLSX from "xlsx";
import { nightsBetween } from "../lib/utils";

export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
export const IMPORT_ACCEPT = ".csv,.xlsx,.xls";

const summaryWords = ["total", "revenue", "occupancy", "rent", "net"];
const mappingAliases = {
  guestName: ["guest", "name", "client", "guest name"],
  checkIn: ["check-in", "checkin", "arrival", "check in", "from"],
  checkOut: ["checkout", "check-out", "departure", "check out", "to"],
  revenue: ["revenue", "amount", "total", "price", "income"],
  status: ["status", "payment", "paid"]
};

export async function parseImportFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension)) throw new Error("Choose a CSV or Excel file");
  if (file.size > MAX_IMPORT_FILE_SIZE) throw new Error("File must be 5MB or smaller");

  if (extension === "csv") {
    const result = Papa.parse(await file.text(), { skipEmptyLines: false });
    if (result.errors?.length && !result.data?.length) throw new Error("We couldn't read this CSV file");
    return { type: "csv", sheets: [{ name: "CSV", rows: normalizeRows(result.data) }] };
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  return {
    type: "excel",
    sheets: workbook.SheetNames.map((name) => ({
      name,
      rows: normalizeRows(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" }))
    }))
  };
}

export function detectHeaderRow(rows) {
  let winner = 0;
  let bestScore = -1;
  rows.slice(0, 10).forEach((row, index) => {
    const values = row.map(cleanCell).filter(Boolean);
    const textValues = values.filter((value) => Number.isNaN(Number(value)));
    const unique = new Set(textValues.map(normalizeHeader)).size;
    const score = textValues.length * 3 + unique - values.length * 0.15;
    if (score > bestScore) {
      bestScore = score;
      winner = index;
    }
  });
  return winner;
}

export function headersFromRow(row) {
  const seen = new Map();
  return row.map((value, index) => {
    const base = cleanCell(value) || `Column ${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

export function guessColumnMappings(headers) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(Object.entries(mappingAliases).map(([field, aliases]) => {
    const exact = normalized.findIndex((header) => aliases.includes(header));
    const partial = normalized.findIndex((header) => aliases.some((alias) => header.includes(alias)));
    return [field, exact >= 0 ? exact : partial >= 0 ? partial : ""];
  }));
}

export function detectDateFormat(samples, context) {
  const options = ["dmy", "mdy", "day"];
  const scores = options.map((format) => ({
    format,
    valid: samples.filter((value) => parseImportDate(value, format, context)).length
  }));
  const firstParts = samples.map(dateParts).filter(Boolean);
  if (firstParts.some((parts) => Number(parts[0]) > 12)) return "dmy";
  if (firstParts.some((parts) => Number(parts[1]) > 12)) return "mdy";
  return scores.sort((a, b) => b.valid - a.valid)[0]?.format || "dmy";
}

export function dateFormatOptions(samples, context) {
  return [
    formatOption("dmy", "Day/Month/Year", samples, context),
    formatOption("mdy", "Month/Day/Year", samples, context),
    formatOption("day", "Day only", samples, context)
  ];
}

export function normalizeImportRows({ rows, headerIndex, mappings, dateFormat, context }) {
  const skipped = [];
  const bookings = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const guestName = cleanCell(row[mappings.guestName]);
    if (looksLikeSummaryRow(row, guestName)) {
      skipped.push({ rowNumber, reason: "Looks like a summary row" });
      return;
    }
    if (!guestName) {
      skipped.push({ rowNumber, reason: "Missing guest name" });
      return;
    }
    if (guestName.length > 200) {
      skipped.push({ rowNumber, reason: "Guest name is longer than 200 characters" });
      return;
    }
    const checkIn = parseImportDate(row[mappings.checkIn], dateFormat, context);
    const checkOut = parseImportDate(row[mappings.checkOut], dateFormat, context);
    if (!checkIn || !checkOut) {
      skipped.push({ rowNumber, reason: !checkIn ? "Invalid check-in date" : "Missing or invalid checkout date" });
      return;
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) {
      skipped.push({ rowNumber, reason: "Checkout must be after check-in" });
      return;
    }
    const revenue = parseImportNumber(row[mappings.revenue]);
    if (revenue === null) {
      skipped.push({ rowNumber, reason: "Revenue is not a valid number" });
      return;
    }
    if (revenue < 0 || revenue > 99999) {
      skipped.push({ rowNumber, reason: revenue < 0 ? "Revenue cannot be negative" : "Revenue is greater than 99,999" });
      return;
    }
    bookings.push({
      importRowNumber: rowNumber,
      guestName,
      checkIn,
      checkOut,
      nights,
      revenue,
      paymentOverride: mappings.status === "" ? null : mapPaymentStatus(row[mappings.status]),
      bookingStatus: "active",
      rating: null
    });
  });
  return { bookings, skipped };
}

export function parseImportNumber(value) {
  let input = cleanCell(value).replace(/[^\d,.-]/g, "");
  if (!input) return null;
  const comma = input.lastIndexOf(",");
  const dot = input.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    input = input.split(decimal === "," ? "." : ",").join("").replace(decimal, ".");
  } else if (comma >= 0) {
    const parts = input.split(",");
    input = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join("");
  } else if ((input.match(/\./g) || []).length > 1) {
    const parts = input.split(".");
    const decimal = parts.at(-1).length <= 2 ? parts.pop() : "";
    input = `${parts.join("")}${decimal ? `.${decimal}` : ""}`;
  }
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseImportDate(value, format, context) {
  const text = cleanCell(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const parts = dateParts(text);
  if (!parts) return null;
  const selectedYear = Number(context.year);
  const selectedMonth = Number(context.month);
  if (format === "day") return parts.length === 1 ? validDate(selectedYear, selectedMonth, Number(parts[0])) : null;
  if (parts.length === 2) {
    return format === "dmy"
      ? validDate(selectedYear, Number(parts[1]), Number(parts[0]))
      : validDate(selectedYear, Number(parts[0]), Number(parts[1]));
  }
  if (parts.length !== 3) return null;
  const year = normalizeYear(parts[2]);
  return format === "dmy"
    ? validDate(year, Number(parts[1]), Number(parts[0]))
    : validDate(year, Number(parts[0]), Number(parts[1]));
}

function formatOption(id, label, samples, context) {
  const interpretations = samples.map((sample) => {
    const parsed = parseImportDate(sample, id, context);
    const result = parsed
      ? new Date(`${parsed}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "invalid";
    return `${cleanCell(sample)} -> ${result}`;
  });
  return { id, label, valid: interpretations.every((value) => !value.endsWith("invalid")), interpretations };
}

function mapPaymentStatus(value) {
  const normalized = cleanCell(value).toLowerCase();
  if (["paid", "yes", "true", "paye"].includes(normalized)) return "paid";
  if (["unpaid", "non paye", "no", "false", ""].includes(normalized)) return "unpaid";
  return null;
}

function looksLikeSummaryRow(row, guestName) {
  if (summaryWords.some((word) => guestName.toLowerCase().includes(word))) return true;
  const nonEmpty = row.map(cleanCell).filter(Boolean);
  return !guestName && nonEmpty.length > 0;
}

function normalizeRows(rows) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
}

function cleanCell(value) {
  return String(value ?? "").trim();
}

function normalizeHeader(value) {
  return cleanCell(value).toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
}

function dateParts(value) {
  const parts = cleanCell(value).match(/\d+/g);
  return parts?.length >= 1 && parts.length <= 3 ? parts : null;
}

function normalizeYear(value) {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function validDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
