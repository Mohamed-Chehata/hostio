export function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function moveMonth(value, amount) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth() + amount, 1);
  }
  const date = new Date(`${value}-01T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKey(value) {
  return value.slice(0, 7);
}

export function monthLabel(value) {
  return new Date(`${value}-02T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

export function shortMonth(value) {
  return new Date(`${value}-02T00:00:00`).toLocaleDateString("en-US", {
    month: "short"
  });
}
