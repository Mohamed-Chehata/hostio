import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Home, Pencil, Plus, Receipt, Sparkles, Trash2, X } from "lucide-react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { BottomSheet } from "../components/BottomSheet";
import { Button, Card, Input } from "../components/ui";
import { cn, monthLabel } from "../lib/utils";

function moveMonth(month, amount) {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function entryDate(expense, fallbackMonth) {
  return expense.date || expense.createdAt?.slice(0, 10) || `${fallbackMonth}-01`;
}

function entryTime(expense) {
  if (expense.createdAt) {
    return new Date(expense.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return expense.time || "--:--";
}

function dateHeading(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function ExpensesScreen({ stats, month, setMonth, currency, costLabels = { rent: "Rent", cleaning: "Cleaning" }, formatCurrency, onUpdateCostLabel, onUpdateFixedCost, onAddExpense, onUpdateExpense, onDeleteExpense }) {
  const [costDrafts, setCostDrafts] = useState({ rent: "", cleaning: "" });
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [newExpenseId, setNewExpenseId] = useState(null);
  const [removingExpenses, setRemovingExpenses] = useState({});
  const previousTotal = useRef(stats.rent + stats.cleaning + stats.expenses);
  const totalCosts = stats.rent + stats.cleaning + stats.expenses;
  const totalDirection = totalCosts > previousTotal.current ? "up" : totalCosts < previousTotal.current ? "down" : null;

  useEffect(() => {
    previousTotal.current = totalCosts;
  }, [totalCosts]);

  const expenses = useMemo(() => [...(stats.randomExpenses || [])].sort((a, b) => {
    const aStamp = a.createdAt || `${entryDate(a, stats.month)}T00:00:00`;
    const bStamp = b.createdAt || `${entryDate(b, stats.month)}T00:00:00`;
    return bStamp.localeCompare(aStamp);
  }), [stats.randomExpenses, stats.month]);

  const displayExpenses = useMemo(() => {
    const existingIds = new Set(expenses.map((expense) => expense.id));
    const removing = Object.values(removingExpenses).filter((expense) => !existingIds.has(expense.id));
    return [...expenses, ...removing].sort((a, b) => {
      const aStamp = a.createdAt || `${entryDate(a, stats.month)}T00:00:00`;
      const bStamp = b.createdAt || `${entryDate(b, stats.month)}T00:00:00`;
      return bStamp.localeCompare(aStamp);
    });
  }, [expenses, removingExpenses, stats.month]);

  const groupedExpenses = useMemo(() => displayExpenses.reduce((groups, expense) => {
    const key = entryDate(expense, stats.month);
    if (!groups[key]) groups[key] = [];
    groups[key].push(expense);
    return groups;
  }, {}), [displayExpenses, stats.month]);

  function setCostDraft(field, value) {
    setCostDrafts((current) => ({ ...current, [field]: value }));
  }

  function addFixedCost(field) {
    const value = costDrafts[field];
    if (value === "") return;
    if (!Number.isFinite(Number(value))) return;
    onUpdateFixedCost(stats.month, field, Number(value));
    setCostDraft(field, "");
  }

  return (
    <main className="px-5 pb-24 pt-6">
      <header>
        <h1 className="text-2xl font-extrabold">Expenses</h1>
        <p className="mt-1 text-sm font-bold text-accent">{monthLabel(stats.month)}</p>
      </header>

      <div className="my-6 flex items-center justify-between rounded-2xl bg-panel p-2">
        <button aria-label="Previous expenses month" onClick={() => setMonth(moveMonth(month, -1))} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-muted"><ChevronLeft size={18} /></button>
        <p className="text-sm font-bold">{monthLabel(month)}</p>
        <button aria-label="Next expenses month" onClick={() => setMonth(moveMonth(month, 1))} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-muted"><ChevronRight size={18} /></button>
      </div>

      <div className="space-y-3">
        <CostAddRow
          icon={Home}
          label={costLabels.rent}
          field="rent"
          value={stats.rent}
          currency={currency}
          formatCurrency={formatCurrency}
          draftValue={costDrafts.rent}
          onDraftChange={(value) => setCostDraft("rent", value)}
          onAdd={() => addFixedCost("rent")}
          onRename={(label) => onUpdateCostLabel("rent", label)}
        />
        <CostAddRow
          icon={Sparkles}
          label={costLabels.cleaning}
          field="cleaning"
          value={stats.cleaning}
          currency={currency}
          formatCurrency={formatCurrency}
          draftValue={costDrafts.cleaning}
          onDraftChange={(value) => setCostDraft("cleaning", value)}
          onAdd={() => addFixedCost("cleaning")}
          onRename={(label) => onUpdateCostLabel("cleaning", label)}
        />
        <RandomExpensesCard
          stats={stats}
          expenses={displayExpenses}
          formatCurrency={formatCurrency}
          newExpenseId={newExpenseId}
          removingExpenseIds={removingExpenses}
          onAdd={() => setAddingExpense(true)}
          onEdit={setEditingExpense}
        />
      </div>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold">Expense History</h2>
        {displayExpenses.length ? (
          <div className="mt-3 space-y-4">
            {Object.entries(groupedExpenses).map(([date, entries]) => (
              <div key={date}>
                <div className="sticky top-0 z-10 -mx-1 mb-2 rounded-xl bg-ink/95 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-muted backdrop-blur">{dateHeading(date)}</div>
                <div className="space-y-2">
                  {entries.map((expense) => (
                    <button key={`history-${expense.id}`} onClick={() => setEditingExpense(expense)} disabled={Boolean(removingExpenses[expense.id])} className={cn("flex w-full items-center justify-between rounded-2xl bg-panel px-4 py-3 text-left transition active:scale-[0.98]", removingExpenses[expense.id] && "expense-row-removing")}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{expense.description}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">{entryTime(expense)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-accent">{formatCurrency(expense.amount)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 rounded-2xl bg-panel px-4 py-5 text-center text-sm font-semibold text-muted">No expense history this month</p>}
      </section>

      <SummaryCard stats={stats} costLabels={costLabels} totalCosts={totalCosts} totalDirection={totalDirection} formatCurrency={formatCurrency} />

      {addingExpense && (
        <AddExpenseSheet
          currency={currency}
          onClose={() => setAddingExpense(false)}
          onSave={(expense) => {
            const id = `${stats.month}-expense-${Date.now()}`;
            onAddExpense(stats.month, { ...expense, id });
            setNewExpenseId(id);
            setAddingExpense(false);
            setTimeout(() => setNewExpenseId(null), 300);
          }}
        />
      )}
      {editingExpense && (
        <EditExpenseSheet
          expense={editingExpense}
          currency={currency}
          onClose={() => setEditingExpense(null)}
          onSave={(expense) => {
            onUpdateExpense(stats.month, expense);
            setEditingExpense(null);
          }}
          onDelete={() => {
            setDeleteCandidate(editingExpense);
            setEditingExpense(null);
          }}
        />
      )}
      {deleteCandidate && (
        <DeleteExpenseConfirmSheet
          expense={deleteCandidate}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => {
            const expense = deleteCandidate;
            setRemovingExpenses((current) => ({ ...current, [expense.id]: expense }));
            onDeleteExpense(stats.month, deleteCandidate.id);
            setDeleteCandidate(null);
            setTimeout(() => setRemovingExpenses((current) => {
              const next = { ...current };
              delete next[expense.id];
              return next;
            }), 450);
          }}
        />
      )}
    </main>
  );
}

function CostAddRow({ icon: Icon, label, value, currency, formatCurrency, draftValue, onDraftChange, onAdd, onRename }) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const previousValue = useRef(value);
  const direction = value > previousValue.current ? "up" : value < previousValue.current ? "down" : null;

  useEffect(() => {
    previousValue.current = value;
  }, [value]);

  useEffect(() => {
    setLabelDraft(label);
  }, [label]);

  function saveLabel() {
    const next = labelDraft.trim();
    if (next) onRename(next);
    setEditingLabel(false);
  }

  function cancelLabel() {
    setLabelDraft(label);
    setEditingLabel(false);
  }

  return (
    <Card className="p-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-muted">
          <Icon size={17} />
          <div className="min-w-0">
            {editingLabel ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={labelDraft}
                  onChange={(event) => setLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveLabel();
                    if (event.key === "Escape") cancelLabel();
                  }}
                  className="field-control min-h-9 w-24 rounded-xl bg-white/[0.04] px-2 text-xs font-bold uppercase tracking-wider text-white"
                />
                <button aria-label={`Save ${label} label`} onClick={saveLabel} className="grid h-9 min-h-9 w-9 place-items-center rounded-xl text-accent"><Check size={14} /></button>
                <button aria-label={`Cancel ${label} label`} onClick={cancelLabel} className="grid h-9 min-h-9 w-9 place-items-center rounded-xl text-muted"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
                <button aria-label={`Rename ${label}`} onClick={() => setEditingLabel(true)} className="grid h-7 min-h-7 w-7 place-items-center rounded-xl text-muted"><Pencil size={11} /></button>
              </div>
            )}
            <p className="mt-0.5 text-[11px] font-semibold normal-case tracking-normal text-muted">
              Current <AnimatedNumber value={value} direction={direction} format={formatCurrency} />
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="relative max-w-[108px]">
            <span className="absolute left-3 top-3 text-sm font-bold text-accent">{currency.symbol}</span>
            <input
              type="number"
              step="0.01"
              value={draftValue}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="0"
              className="field-control min-h-11 w-full rounded-2xl bg-white/[0.04] pl-7 pr-3 text-right text-sm font-extrabold text-white placeholder:text-muted"
            />
          </div>
          <button aria-label={`Add ${label}`} disabled={draftValue === ""} onClick={onAdd} className={cn("h-11 rounded-2xl px-4 text-sm font-extrabold transition active:scale-[0.98]", draftValue === "" ? "bg-white/5 text-muted" : "bg-accent text-ink")}>Add</button>
        </div>
      </div>
    </Card>
  );
}

function RandomExpensesCard({ stats, expenses, formatCurrency, newExpenseId, removingExpenseIds, onAdd, onEdit }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-muted">
          <Receipt size={18} />
          <p className="text-xs font-bold uppercase tracking-wider">Expenses</p>
        </div>
        <button aria-label="Add expense" onClick={onAdd} className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-ink"><Plus size={19} /></button>
      </div>

      <div className="mt-4 space-y-2">
        {expenses.length ? expenses.map((expense) => (
          <ExpenseRow
            key={expense.id}
            expense={expense}
            month={stats.month}
            formatCurrency={formatCurrency}
            isNew={newExpenseId === expense.id}
            isRemoving={Boolean(removingExpenseIds[expense.id])}
            onEdit={() => onEdit(expense)}
          />
        )) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.03] px-4 py-7 text-center text-muted">
            <Receipt size={24} />
            <p className="mt-2 text-sm font-semibold">No expenses yet</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ExpenseRow({ expense, month, formatCurrency, isNew, isRemoving, onEdit }) {
  return (
    <button data-expense-row={expense.id} onClick={onEdit} disabled={isRemoving} className={cn("flex h-[72px] w-full items-center justify-between gap-3 rounded-[16px] bg-[#242424] px-4 text-left transition-transform duration-150 ease-in-out active:scale-[0.97]", isNew && "animate-expense-entry", isRemoving && "expense-row-removing")}>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{expense.description}</p>
          <p className="mt-1 text-xs font-semibold text-muted">{dateHeading(entryDate(expense, month))} · {entryTime(expense)}</p>
        </div>
        <p className="shrink-0 text-sm font-extrabold text-accent">{formatCurrency(expense.amount)}</p>
    </button>
  );
}

function AddExpenseSheet({ currency, onClose, onSave }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const valid = description.trim() && amount && date;
  const formValid = description.trim().length > 0 && description.trim().length <= 200 && amount && Number.isFinite(Number(amount)) && Number(amount) >= 0 && date;

  function submit(event) {
    event.preventDefault();
    if (!formValid) return;
    const now = new Date();
    const createdAt = `${date}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    onSave({ description: description.trim(), amount: Number(amount), date, createdAt });
  }

  return (
    <BottomSheet title="Add expense" description="Track one-off costs for this month." onClose={onClose} lifted>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Description</span>
          <Input autoFocus maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Broken lamp" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Amount</span>
          <div className="relative">
            <span className="absolute left-4 top-3 text-sm font-bold text-accent">{currency.symbol}</span>
            <Input className="pl-8" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" />
          </div>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Date</span>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <Button disabled={!formValid} className={cn("w-full py-4", !formValid && "opacity-50")} type="submit">Save expense</Button>
      </form>
    </BottomSheet>
  );
}

function EditExpenseSheet({ expense, currency, onClose, onSave, onDelete }) {
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(expense.amount));
  const [date, setDate] = useState(entryDate(expense, expense.date?.slice(0, 7) || todayInputValue().slice(0, 7)));
  const valid = description.trim() && amount && date;
  const formValid = description.trim().length > 0 && description.trim().length <= 200 && amount && Number.isFinite(Number(amount)) && Number(amount) >= 0 && date;

  function submit(event) {
    event.preventDefault();
    if (!formValid) return;
    const time = expense.createdAt?.slice(11, 19) || "00:00:00";
    onSave({
      ...expense,
      description: description.trim(),
      amount: Number(amount),
      date,
      createdAt: `${date}T${time}`
    });
  }

  return (
    <BottomSheet title="Edit expense" description="Update or remove this expense." onClose={onClose} lifted>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Description</span>
          <Input autoFocus maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Amount</span>
          <div className="relative">
            <span className="absolute left-4 top-3 text-sm font-bold text-accent">{currency.symbol}</span>
            <Input className="pl-8" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Date</span>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <Button disabled={!formValid} className={cn("w-full py-4", !formValid && "opacity-50")} type="submit">Save changes</Button>
        <button type="button" onClick={onDelete} className="min-h-11 w-full rounded-2xl text-sm font-extrabold text-red-300 transition active:scale-[0.98]">Delete expense</button>
      </form>
    </BottomSheet>
  );
}

function DeleteExpenseConfirmSheet({ expense, onCancel, onConfirm }) {
  return (
    <BottomSheet title="" onClose={onCancel}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-red-300">
          <Trash2 size={24} />
        </div>
        <h2 className="mt-4 text-xl font-extrabold">Delete expense?</h2>
        <p className="mt-2 text-sm leading-5 text-muted">This will permanently remove "{expense.description}".</p>
        <div className="mt-6 space-y-3">
          <Button variant="danger" onClick={onConfirm} className="w-full bg-red-500 text-white hover:bg-red-500">Delete</Button>
          <Button variant="ghost" onClick={onCancel} className="w-full text-muted">Cancel</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function SummaryCard({ stats, costLabels, totalCosts, totalDirection, formatCurrency }) {
  return (
    <Card className="sticky bottom-[76px] z-20 mt-7 border-t-2 border-accent bg-[#202020] p-4 shadow-2xl">
      <div className="space-y-2 text-sm font-semibold">
        <div className="flex items-center justify-between"><span className="text-muted">{costLabels.rent}</span><span>{formatCurrency(stats.rent)}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted">{costLabels.cleaning}</span><span>{formatCurrency(stats.cleaning)}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted">Expenses</span><span>{formatCurrency(stats.expenses)}</span></div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-base font-extrabold">Total</span>
        <span className="text-xl font-extrabold text-accent"><AnimatedNumber value={totalCosts} direction={totalDirection} format={formatCurrency} /></span>
      </div>
    </Card>
  );
}
