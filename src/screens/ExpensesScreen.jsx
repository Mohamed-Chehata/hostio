import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Home, Pencil, Plus, Receipt, Sparkles, Trash2, X } from "lucide-react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { BottomSheet } from "../components/BottomSheet";
import { MoneyInput, validateMoneyValue } from "../components/MoneyInput";
import { MonthNavigator } from "../components/MonthNavigator";
import { Skeleton, SkeletonList } from "../components/Skeleton";
import { Button, Card, Input } from "../components/ui";
import { cn } from "../lib/utils";
import { monthLabel, moveMonth } from "../utils/monthUtils";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { OfflineUnavailable } from "../components/OfflineUnavailable";

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

export function ExpensesScreen({ stats, month, setMonth, activePropertyName = "My Property", onOpenProperties, isLoading = false, isInitialized = false, offlineUnavailable = false, isOnline = true, isSyncing = false, onRetry, currency, costLabels = { rent: "Rent", cleaning: "Cleaning" }, formatCurrency, onUpdateCostLabel, onUpdateFixedCost, onAddExpense, onUpdateExpense, onDeleteExpense }) {
  const [costDrafts, setCostDrafts] = useState({ rent: "", cleaning: "" });
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [newExpenseId, setNewExpenseId] = useState(null);
  const [removingExpenses, setRemovingExpenses] = useState({});
  const previousTotal = useRef(stats.rent + stats.cleaning + stats.expenses);
  const totalCosts = stats.rent + stats.cleaning + stats.expenses;
  const totalDirection = totalCosts > previousTotal.current ? "up" : totalCosts < previousTotal.current ? "down" : null;
  const showSkeleton = !isInitialized || isLoading;

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

  async function addFixedCost(field) {
    const value = costDrafts[field];
    if (value === "") return;
    if (validateMoneyValue(value)) return;
    const updated = await onUpdateFixedCost(stats.month, field, Number(value));
    if (updated) setCostDraft(field, "");
  }

  return (
    <main className="px-5 pb-24 pt-6">
      <header>
        <button onClick={onOpenProperties} className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-2xl px-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
          <span className="max-w-[240px] truncate">{activePropertyName}</span>
          <ChevronDown size={13} />
        </button>
        <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />
        <h1 className="text-2xl font-extrabold">Expenses</h1>
        <p className="mt-1 text-sm font-bold text-accent">{monthLabel(stats.month)}</p>
      </header>

      <MonthNavigator
        className="my-6 rounded-2xl bg-panel p-2"
        label={monthLabel(month)}
        previousLabel="Previous expenses month"
        nextLabel="Next expenses month"
        onPrevious={() => setMonth(moveMonth(month, -1))}
        onNext={() => setMonth(moveMonth(month, 1))}
      />

      {offlineUnavailable && <OfflineUnavailable onRetry={onRetry} />}
      <div className={offlineUnavailable ? "hidden" : ""}>
      <div className="space-y-3">
        {showSkeleton ? (
          <ExpensesSkeleton />
        ) : (
          <>
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
              pending={Boolean(stats.pendingSync)}
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
              pending={Boolean(stats.pendingSync)}
            />
            <RandomExpensesCard
              stats={stats}
              expenses={displayExpenses}
              formatCurrency={formatCurrency}
              newExpenseId={newExpenseId}
              removingExpenseIds={removingExpenses}
              onAdd={() => setAddingExpense(true)}
              onEdit={setEditingExpense}
              isLoading={showSkeleton}
            />
          </>
        )}
      </div>

      <section className="mt-7">
        <h2 className="text-lg font-extrabold">Expense History</h2>
        {showSkeleton ? (
          <SkeletonList className="h-[64px]" wrapperClassName="mt-3 space-y-2" />
        ) : isInitialized && displayExpenses.length ? (
          <div className="mt-3 space-y-4">
            {Object.entries(groupedExpenses).map(([date, entries]) => (
              <div key={date}>
                <div className="sticky top-0 z-10 -mx-1 mb-2 rounded-xl bg-app/95 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-muted backdrop-blur">{dateHeading(date)}</div>
                <div className="space-y-2">
                  {entries.map((expense) => (
                    <button key={`history-${expense.id}`} onClick={() => setEditingExpense(expense)} disabled={Boolean(removingExpenses[expense.id])} className={cn("relative flex w-full items-center justify-between rounded-2xl bg-panel px-4 py-3 text-left transition active:scale-[0.98]", removingExpenses[expense.id] && "expense-row-removing")}>
                      {expense.pendingSync && <span aria-label="Waiting to sync" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />}
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

      {showSkeleton ? <Skeleton className="sticky bottom-[76px] z-20 mt-7 h-[156px]" /> : <SummaryCard stats={stats} costLabels={costLabels} totalCosts={totalCosts} totalDirection={totalDirection} formatCurrency={formatCurrency} />}
      </div>

      {addingExpense && (
        <AddExpenseSheet
          currency={currency}
          onClose={() => setAddingExpense(false)}
          onSave={async (expense) => {
            const id = `${stats.month}-expense-${Date.now()}`;
            const added = await onAddExpense(stats.month, { ...expense, id });
            if (!added) return;
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
          onSave={async (expense) => {
            const updated = await onUpdateExpense(stats.month, expense);
            if (updated) setEditingExpense(null);
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
          onConfirm={async () => {
            const expense = deleteCandidate;
            setRemovingExpenses((current) => ({ ...current, [expense.id]: expense }));
            const deleted = await onDeleteExpense(stats.month, deleteCandidate.id);
            if (!deleted) {
              setRemovingExpenses((current) => {
                const next = { ...current };
                delete next[expense.id];
                return next;
              });
              return;
            }
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

function CostAddRow({ icon: Icon, label, value, currency, formatCurrency, draftValue, onDraftChange, onAdd, onRename, pending }) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [amountError, setAmountError] = useState("");
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

  function saveAmount() {
    const nextError = validateMoneyValue(draftValue);
    setAmountError(nextError);
    if (nextError) return;
    onAdd();
  }

  return (
    <Card className="relative p-3">
      {pending && <span aria-label="Waiting to sync" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />}
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
          <MoneyInput
            ariaLabel={label}
            currency={currency}
            value={draftValue}
            onChange={onDraftChange}
            externalError={amountError}
            onValidityChange={(_, message) => setAmountError(message)}
            className="max-w-[108px]"
            inputClassName="pr-3 text-right text-sm font-extrabold"
          />
          <button aria-label={`Save ${label}`} disabled={draftValue === ""} onClick={saveAmount} className={cn("h-11 rounded-2xl px-4 text-sm font-extrabold transition active:scale-[0.98]", draftValue === "" ? "bg-white/5 text-muted" : "bg-accent text-ink")}>Save</button>
        </div>
      </div>
    </Card>
  );
}

function ExpensesSkeleton() {
  return (
    <>
      <Skeleton className="h-[78px]" />
      <Skeleton className="h-[78px]" />
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-11 w-11" />
        </div>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-[72px] rounded-[16px]" />)}
        </div>
      </Card>
    </>
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
    <button data-expense-row={expense.id} onClick={onEdit} disabled={isRemoving} className={cn("relative flex h-[72px] w-full items-center justify-between gap-3 rounded-[16px] border border-border bg-panel px-4 text-left transition-transform duration-150 ease-in-out active:scale-[0.97]", isNew && "animate-expense-entry", isRemoving && "expense-row-removing")}>
        {expense.pendingSync && <span aria-label="Waiting to sync" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />}
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
  const [amountError, setAmountError] = useState("");
  const formValid = description.trim().length > 0 && description.trim().length <= 200 && !validateMoneyValue(amount) && date;

  function submit(event) {
    event.preventDefault();
    const nextAmountError = validateMoneyValue(amount);
    setAmountError(nextAmountError);
    if (!formValid || nextAmountError) return;
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
          <MoneyInput ariaLabel="Amount" currency={currency} value={amount} onChange={setAmount} externalError={amountError} onValidityChange={(_, message) => setAmountError(message)} />
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
  const [amountError, setAmountError] = useState("");
  const formValid = description.trim().length > 0 && description.trim().length <= 200 && !validateMoneyValue(amount) && date;

  function submit(event) {
    event.preventDefault();
    const nextAmountError = validateMoneyValue(amount);
    setAmountError(nextAmountError);
    if (!formValid || nextAmountError) return;
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
          <MoneyInput ariaLabel="Amount" currency={currency} value={amount} onChange={setAmount} externalError={amountError} onValidityChange={(_, message) => setAmountError(message)} />
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
          <Button variant="danger" onClick={onConfirm} className="w-full bg-red-500 text-[#FFFFFF] hover:bg-red-500">Delete</Button>
          <Button variant="ghost" onClick={onCancel} className="w-full text-muted">Cancel</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function SummaryCard({ stats, costLabels, totalCosts, totalDirection, formatCurrency }) {
  return (
    <Card className="sticky bottom-[76px] z-20 mt-7 border-t-2 border-accent bg-panel p-4 shadow-2xl">
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
