import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  RefreshCw,
  Upload
} from "lucide-react";
import { Button, Card, Input } from "../components/ui";
import {
  dateFormatOptions,
  detectDateFormat,
  detectHeaderRow,
  guessColumnMappings,
  headersFromRow,
  IMPORT_ACCEPT,
  MAX_IMPORT_FILE_SIZE,
  normalizeImportRows,
  parseImportFile
} from "../utils/bookingImport";

const fieldOptions = [
  ["guestName", "Guest name", true],
  ["checkIn", "Check-in", true],
  ["checkOut", "Checkout", true],
  ["revenue", "Revenue", true],
  ["status", "Payment status", false]
];

export function ImportBookingsScreen({
  properties,
  formatCurrency,
  onBack,
  onAddProperty,
  onCheckConflicts,
  onImport,
  onViewBookings
}) {
  const inputRef = useRef(null);
  const [stepId, setStepId] = useState("property");
  const [direction, setDirection] = useState("forward");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [addingProperty, setAddingProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [parsedFile, setParsedFile] = useState(null);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [rows, setRows] = useState([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const now = new Date();
  const [context, setContext] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [dateFormat, setDateFormat] = useState("dmy");
  const [normalized, setNormalized] = useState({ bookings: [], skipped: [] });
  const [conflictResult, setConflictResult] = useState({ ready: [], conflicts: [] });
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [fileProgress, setFileProgress] = useState("idle");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const dateSamples = useMemo(() => {
    if (mappings.checkIn === "" || mappings.checkIn === undefined) return [];
    return rows.slice(headerIndex + 1).map((row) => row[mappings.checkIn]).filter(Boolean).slice(0, 3);
  }, [headerIndex, mappings.checkIn, rows]);
  const dateOptions = useMemo(() => dateFormatOptions(dateSamples, context), [context, dateSamples]);
  const requiredMapped = fieldOptions.filter(([, , required]) => required).every(([key]) => mappings[key] !== "" && mappings[key] !== undefined);
  const previewRows = rows.slice(0, 10);
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
  const hasSheetSelection = parsedFile?.type === "excel" && parsedFile.sheets.length > 1;
  const steps = [
    "property",
    "upload",
    ...(hasSheetSelection ? ["sheetSelect"] : []),
    "headerDetect",
    "dateContext",
    "columnMapping",
    "dateFormat",
    "validation",
    "conflicts",
    "confirm",
    "import"
  ];
  const stepIndex = Math.max(0, steps.indexOf(stepId));
  const stepNumber = stepIndex + 1;

  function moveTo(next, nextDirection = "forward") {
    setDirection(nextDirection);
    setStepId(next);
    setError("");
  }

  function initializeRows(nextRows) {
    const detectedHeader = detectHeaderRow(nextRows);
    const nextHeaders = headersFromRow(nextRows[detectedHeader] || []);
    const nextMappings = guessColumnMappings(nextHeaders);
    const samples = nextRows.slice(detectedHeader + 1).map((row) => row[nextMappings.checkIn]).filter(Boolean).slice(0, 3);
    setRows(nextRows);
    setHeaderIndex(detectedHeader);
    setHeaders(nextHeaders);
    setMappings(nextMappings);
    setDateFormat(detectDateFormat(samples, context));
  }

  async function chooseFile(file) {
    if (!file || parsingFile) return;
    setParsingFile(true);
    setFileProgress("reading");
    setError("");
    try {
      const [parsed] = await Promise.all([
        parseImportFile(file),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
      setParsedFile({ ...parsed, name: file.name, size: file.size });
      setSelectedSheet(0);
      setFileProgress("success");
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (parsed.type === "excel" && parsed.sheets.length > 1) {
        moveTo("sheetSelect");
      } else {
        initializeRows(parsed.sheets[0].rows);
        moveTo("headerDetect");
      }
    } catch {
      setFileProgress("error");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setParsingFile(false);
    }
  }

  function selectSheetAndContinue() {
    initializeRows(parsedFile.sheets[selectedSheet].rows);
    moveTo("headerDetect");
  }

  function applyHeader() {
    const nextHeaders = headersFromRow(rows[headerIndex] || []);
    const nextMappings = guessColumnMappings(nextHeaders);
    setHeaders(nextHeaders);
    setMappings(nextMappings);
    moveTo("dateContext");
  }

  function continueFromMapping() {
    if (!requiredMapped) {
      setError("Map all four required fields to continue");
      return;
    }
    const samples = rows.slice(headerIndex + 1).map((row) => row[mappings.checkIn]).filter(Boolean).slice(0, 3);
    setDateFormat(detectDateFormat(samples, context));
    moveTo("dateFormat");
  }

  function validateRows() {
    const next = normalizeImportRows({ rows, headerIndex, mappings, dateFormat, context });
    setNormalized(next);
    moveTo("validation");
  }

  async function analyzeConflicts() {
    setCheckingConflicts(true);
    setError("");
    const checked = await onCheckConflicts(selectedPropertyId, normalized.bookings);
    setCheckingConflicts(false);
    if (!checked) {
      setError("Something went wrong");
      return;
    }
    setConflictResult(checked);
    moveTo("conflicts");
  }

  async function runImport(records = conflictResult.ready, retry = false) {
    if (!records.length || importing) return;
    setImporting(true);
    setProgress({ completed: 0, total: records.length });
    moveTo("import");
    const nextResult = await onImport(selectedPropertyId, records, setProgress);
    setResult((current) => retry && current ? {
      succeeded: [...current.succeeded, ...nextResult.succeeded],
      failed: nextResult.failed,
      insertedCount: current.insertedCount + nextResult.insertedCount
    } : nextResult);
    setImporting(false);
  }

  function goBack() {
    if (stepId === "property") {
      onBack();
      return;
    }
    if (stepId === "import" && importing) return;
    moveTo(steps[Math.max(0, stepIndex - 1)], "back");
  }

  function viewBookings() {
    const first = result?.succeeded?.[0] || conflictResult.ready[0];
    onViewBookings(selectedPropertyId, first?.checkIn?.slice(0, 7));
  }

  async function createProperty() {
    const name = newPropertyName.trim();
    if (!name || name.length > 100 || creatingProperty) return;
    setCreatingProperty(true);
    const property = await onAddProperty(name);
    setCreatingProperty(false);
    if (!property) {
      setError("Something went wrong");
      return;
    }
    setSelectedPropertyId(property.id);
    setAddingProperty(false);
    setNewPropertyName("");
  }

  return (
    <main className="min-h-screen bg-app px-5 pb-10 pt-6">
      <header className="flex items-center gap-3">
        <button onClick={goBack} disabled={stepId === "import" && importing} aria-label="Go back" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-panel text-muted transition-transform active:scale-[0.97] disabled:opacity-40">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">Step {stepNumber} of {steps.length}</p>
          <h1 className="truncate text-xl font-extrabold">Import bookings</h1>
        </div>
      </header>

      <div className="mt-5 flex gap-1.5">
        {steps.map((stepName, index) => (
          <span key={stepName} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${index <= stepIndex ? "bg-accent" : "bg-white/10"}`} />
        ))}
      </div>

      <section key={stepId} className={`mt-7 ${direction === "forward" ? "animate-screen-enter-right" : "animate-screen-enter-left"}`}>
        {stepId === "property" && (
          <Step title="Which property is this for?" subtitle="Imported bookings will be added to this property">
            <div className="mt-6 space-y-2">
              {properties.map((property) => {
                const selected = property.id === selectedPropertyId;
                return (
                  <button key={property.id} onClick={() => setSelectedPropertyId(property.id)} className={`flex min-h-14 w-full items-center rounded-2xl px-4 text-left transition-colors ${selected ? "bg-accent text-ink" : "bg-panel text-white"}`}>
                    <span className="font-bold">{property.name}</span>
                    <span className={`ml-auto grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-ink bg-ink text-accent" : "border-white/20"}`}>
                      {selected && <Check size={12} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {!addingProperty ? (
              <button onClick={() => setAddingProperty(true)} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left font-bold text-accent transition-colors hover:bg-white/[0.03]">
                <Plus size={18} /> Add new property
              </button>
            ) : (
              <Card className="mt-3 p-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">
                  Property name
                  <Input
                    autoFocus
                    maxLength={100}
                    value={newPropertyName}
                    onChange={(event) => {
                      setNewPropertyName(event.target.value);
                      setError("");
                    }}
                    placeholder="Beach House"
                    className="mt-2"
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Button variant="ghost" onClick={() => { setAddingProperty(false); setNewPropertyName(""); }}>Cancel</Button>
                  <Button disabled={!newPropertyName.trim() || creatingProperty} onClick={createProperty} className="disabled:opacity-40">
                    {creatingProperty ? "Creating..." : "Create"}
                  </Button>
                </div>
              </Card>
            )}
            <ContinueButton disabled={!selectedPropertyId} onClick={() => moveTo("upload")}>Continue</ContinueButton>
          </Step>
        )}

        {stepId === "upload" && (
          <Step title="Choose your file" subtitle="Upload bookings from CSV or Excel. Your file stays on this device.">
            <input ref={inputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
            <button
              disabled={parsingFile}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                chooseFile(event.dataTransfer.files?.[0]);
              }}
              className={`mt-6 flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition-colors disabled:cursor-wait ${dragging ? "border-accent bg-accent/10" : "border-white/15 bg-panel"}`}
            >
              <Upload className="text-accent" size={30} />
              <span className="mt-4 text-base font-extrabold">{parsedFile?.name || "Select a file"}</span>
              <span className="mt-2 text-sm text-muted">CSV, XLSX, or XLS up to {MAX_IMPORT_FILE_SIZE / 1024 / 1024} MB</span>
            </button>
            {fileProgress !== "idle" && (
              <div className="mt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${fileProgress === "success" ? "w-full bg-[#4ADE80] transition-colors duration-200" : fileProgress === "error" ? "w-full bg-[#EF4444]" : "animate-import-file-progress bg-accent"}`}
                  />
                </div>
                <p className={`mt-2 text-center text-xs font-semibold ${fileProgress === "error" ? "text-[#EF4444]" : "text-muted"}`}>
                  {fileProgress === "error" ? "Couldn't read this file. Please check the format and try again." : "Reading your file..."}
                </p>
                {fileProgress === "error" && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFileProgress("idle");
                      setError("");
                      inputRef.current?.click();
                    }}
                    className="mt-3 w-full"
                  >
                    Try again
                  </Button>
                )}
              </div>
            )}
          </Step>
        )}

        {stepId === "sheetSelect" && (
          <Step title="Choose a sheet" subtitle={`${parsedFile?.name} contains multiple worksheets.`}>
            <div className="mt-6 space-y-2">
              {parsedFile?.sheets.map((sheet, index) => (
                <button key={sheet.name} onClick={() => setSelectedSheet(index)} className={`flex min-h-14 w-full items-center rounded-2xl px-4 text-left ${selectedSheet === index ? "bg-accent text-ink" : "bg-panel text-white"}`}>
                  <FileSpreadsheet size={18} />
                  <span className="ml-3 font-bold">{sheet.name}</span>
                  <span className="ml-auto text-xs opacity-70">{sheet.rows.length} rows</span>
                </button>
              ))}
            </div>
            <ContinueButton onClick={selectSheetAndContinue}>Continue</ContinueButton>
          </Step>
        )}

        {stepId === "headerDetect" && (
          <Step title="Find the header row" subtitle="We detected the row containing your column names. Adjust it if needed.">
            <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-muted">
              Header row
              <select value={headerIndex} onChange={(event) => setHeaderIndex(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-panel px-4 text-sm text-white">
                {rows.slice(0, 10).map((_, index) => <option key={index} value={index}>Row {index + 1}</option>)}
              </select>
            </label>
            <TablePreview rows={previewRows} highlightIndex={headerIndex} />
            <ContinueButton onClick={applyHeader}>Use this header</ContinueButton>
          </Step>
        )}

        {stepId === "dateContext" && (
          <Step title="Add date context" subtitle="This helps us understand dates that omit a month or year.">
            <Card className="mt-6 grid grid-cols-2 gap-3 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Month
                <select value={context.month} onChange={(event) => setContext((current) => ({ ...current, month: Number(event.target.value) }))} className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-app px-3 text-white">
                  {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2025, index).toLocaleDateString("en-US", { month: "long" })}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Year
                <select value={context.year} onChange={(event) => setContext((current) => ({ ...current, year: Number(event.target.value) }))} className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-app px-3 text-white">
                  {Array.from({ length: 9 }, (_, index) => now.getFullYear() - 4 + index).map((year) => <option key={year}>{year}</option>)}
                </select>
              </label>
            </Card>
            <ContinueButton onClick={() => moveTo("columnMapping")}>Continue</ContinueButton>
          </Step>
        )}

        {stepId === "columnMapping" && (
          <Step title="Match your columns" subtitle="Confirm which spreadsheet column belongs to each booking field.">
            <div className="mt-6 space-y-3">
              {fieldOptions.map(([key, label, required]) => (
                <Card key={key} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{label}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{required ? "Required" : "Optional"}</span>
                  </div>
                  <select
                    value={mappings[key] ?? ""}
                    onChange={(event) => setMappings((current) => ({ ...current, [key]: event.target.value === "" ? "" : Number(event.target.value) }))}
                    className="mt-3 min-h-12 w-full rounded-2xl border border-border bg-app px-3 text-sm text-white"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
                  </select>
                  {mappings[key] !== "" && mappings[key] !== undefined && (
                    <p className="mt-2 truncate text-xs text-muted">Sample: {String(rows[headerIndex + 1]?.[mappings[key]] ?? "-")}</p>
                  )}
                </Card>
              ))}
            </div>
            <ContinueButton disabled={!requiredMapped} onClick={continueFromMapping}>Continue</ContinueButton>
          </Step>
        )}

        {stepId === "dateFormat" && (
          <Step title="Choose the date format" subtitle="Check the examples carefully before continuing.">
            <div className="mt-6 space-y-3">
              {dateOptions.map((option) => (
                <button key={option.id} onClick={() => setDateFormat(option.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${dateFormat === option.id ? "border-accent bg-accent/10" : "border-white/10 bg-panel"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold">{option.label}</span>
                    {dateFormat === option.id && <Check className="text-accent" size={18} />}
                  </div>
                  {option.interpretations.map((example) => <p key={example} className="mt-2 text-xs text-muted">{example}</p>)}
                </button>
              ))}
            </div>
            <ContinueButton onClick={validateRows}>Validate rows</ContinueButton>
          </Step>
        )}

        {stepId === "validation" && (
          <Step title="Review validation" subtitle="Malformed and summary rows are skipped before anything is added to your database.">
            <CountCards valid={normalized.bookings.length} skipped={normalized.skipped.length} />
            <IssueList title="Skipped rows" items={normalized.skipped.map((item) => `Row ${item.rowNumber}: ${item.reason}`)} />
            <ContinueButton disabled={!normalized.bookings.length || checkingConflicts} onClick={analyzeConflicts}>
              {checkingConflicts ? <LoaderCircle className="animate-spin" size={18} /> : "Check date conflicts"}
            </ContinueButton>
          </Step>
        )}

        {stepId === "conflicts" && (
          <Step title="Resolve conflicts" subtitle="Conflicting bookings are skipped so the database overlap constraint remains protected.">
            <CountCards valid={conflictResult.ready.length} skipped={conflictResult.conflicts.length} />
            <IssueList
              title="Date conflicts"
              items={conflictResult.conflicts.map(({ record, conflict, source }) => `Row ${record.importRowNumber}: ${record.guestName} overlaps ${conflict.guestName} (${conflict.checkIn} to ${conflict.checkOut})${source === "file" ? " in this file" : ""}`)}
            />
            <ContinueButton disabled={!conflictResult.ready.length} onClick={() => moveTo("confirm")}>Continue</ContinueButton>
          </Step>
        )}

        {stepId === "confirm" && (
          <Step title="Ready to import" subtitle="Review the destination and booking count. This action cannot be undone as a group.">
            <Card className="mt-6 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Active property</p>
              <p className="mt-1 text-lg font-extrabold text-accent">{selectedProperty?.name}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-sm text-muted">Bookings to import</span>
                <span className="font-extrabold">{conflictResult.ready.length}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted">Total revenue</span>
                <span className="font-extrabold">{formatCurrency(conflictResult.ready.reduce((total, booking) => total + booking.revenue, 0))}</span>
              </div>
            </Card>
            <div className="mt-4 flex gap-3 rounded-2xl bg-amber-400/10 p-4 text-amber-200">
              <AlertTriangle className="shrink-0" size={18} />
              <p className="text-xs leading-5">Imported rows become real bookings immediately. Review your mappings before continuing.</p>
            </div>
            <ContinueButton onClick={() => runImport()}>Import bookings</ContinueButton>
          </Step>
        )}

        {stepId === "import" && (
          <Step
            title={importing ? "Importing bookings" : result?.failed.length ? "Import completed with issues" : "Import complete"}
            subtitle={importing ? "Keep this screen open while batches are saved." : `${result?.insertedCount || 0} bookings were added to ${selectedProperty?.name}.`}
          >
            {importing ? (
              <Card className="mt-6 p-5 text-center">
                <LoaderCircle className="mx-auto animate-spin text-accent" size={30} />
                <p className="mt-4 text-sm font-bold">{progress.completed} of {progress.total}</p>
                <progress value={progress.completed} max={progress.total || 1} className="mt-4 h-2 w-full overflow-hidden rounded-full accent-accent" />
              </Card>
            ) : (
              <>
                <div className="mt-7 text-center">
                  <div className="animate-delete-done mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check size={30} /></div>
                </div>
                {result?.failed.length > 0 && (
                  <>
                    <IssueList title="Failed rows" items={result.failed.map(({ record, reason }) => `Row ${record.importRowNumber}: ${reason}`)} />
                    <Button onClick={() => runImport(result.failed.map((item) => item.record), true)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2">
                      <RefreshCw size={17} /> Retry failed rows
                    </Button>
                  </>
                )}
                {result?.insertedCount > 0 && (
                  <Button onClick={viewBookings} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2">
                    View in Bookings <ChevronRight size={17} />
                  </Button>
                )}
              </>
            )}
          </Step>
        )}

        {error && <p className="mt-4 animate-field-error text-sm font-semibold text-[#EF4444]">{error}</p>}
      </section>
    </main>
  );
}

function Step({ title, subtitle, children }) {
  return (
    <>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
      {children}
    </>
  );
}

function ContinueButton({ children, disabled = false, onClick }) {
  return (
    <Button disabled={disabled} onClick={onClick} className="mt-6 flex min-h-12 w-full items-center justify-center transition-[opacity,transform] duration-300 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </Button>
  );
}

function TablePreview({ rows, highlightIndex }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-left text-xs">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === highlightIndex ? "bg-accent/15 text-accent" : "border-t border-white/5"}>
              <td className="whitespace-nowrap px-3 py-3 font-bold">{rowIndex + 1}</td>
              {row.slice(0, 6).map((cell, cellIndex) => <td key={cellIndex} className="max-w-36 truncate whitespace-nowrap px-3 py-3">{String(cell || "-")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountCards({ valid, skipped }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      <Card className="p-4"><p className="text-xs font-bold uppercase text-muted">Ready</p><p className="mt-1 text-2xl font-extrabold text-emerald-300">{valid}</p></Card>
      <Card className="p-4"><p className="text-xs font-bold uppercase text-muted">Skipped</p><p className="mt-1 text-2xl font-extrabold text-orange-300">{skipped}</p></Card>
    </div>
  );
}

function IssueList({ title, items }) {
  if (!items.length) return null;
  return (
    <Card className="mt-4 max-h-56 overflow-y-auto p-4">
      <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => <p key={`${item}-${index}`} className="text-xs leading-5 text-orange-200">{item}</p>)}
      </div>
    </Card>
  );
}
