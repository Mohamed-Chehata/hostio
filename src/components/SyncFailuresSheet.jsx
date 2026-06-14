import { useState } from "react";
import { CalendarDays, LoaderCircle, Receipt, RotateCcw, Trash2, WalletCards, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { getDataError } from "../utils/errorHandler";
import { dateLabel } from "../lib/utils";
import { cn } from "../lib/utils";

export function SyncFailuresSheet({ failures, formatCurrency, onRetry, onRetryAll, onDiscard, onClose }) {
  const [retrying, setRetrying] = useState(new Set());
  const [removing, setRemoving] = useState(new Set());
  const [discardCandidate, setDiscardCandidate] = useState(null);

  if (!failures.length) return null;

  async function retry(id) {
    setRetrying((current) => new Set(current).add(id));
    const result = await onRetry(id);
    setRetrying((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (!result?.success) return;
    setRemoving((current) => new Set(current).add(id));
  }

  async function retryAll() {
    setRetrying(new Set(failures.map((failure) => failure.id)));
    await onRetryAll();
    setRetrying(new Set());
  }

  function confirmDiscard() {
    const id = discardCandidate;
    setDiscardCandidate(null);
    setRemoving((current) => new Set(current).add(id));
    setTimeout(() => onDiscard(id), 300);
  }

  return (
    <BottomSheet title="Unsynced changes" description="Review changes that haven't reached your account yet." onClose={onClose}>
      <button onClick={retryAll} className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-accent text-sm font-extrabold text-accent">
        <RotateCcw size={16} /> Retry all
      </button>
      <div className="space-y-2">
        {failures.map((failure) => (
          <div key={failure.id} className={cn("overflow-hidden rounded-2xl border border-border bg-panel p-4", removing.has(failure.id) && "animate-sync-item-remove")}>
            <div className="flex items-start gap-3">
              <OperationIcon type={failure.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{operationDescription(failure, formatCurrency)}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{getDataError({ code: failure.errorCode, message: failure.errorMessage || failure.reason })}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button disabled={retrying.has(failure.id)} onClick={() => retry(failure.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-extrabold text-ink disabled:opacity-60">
                {retrying.has(failure.id) ? <LoaderCircle className="animate-spin" size={16} /> : <RotateCcw size={16} />} Retry
              </button>
              <button onClick={() => setDiscardCandidate(failure.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border text-sm font-extrabold text-red-400">
                <Trash2 size={16} /> Discard
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-muted">
        <X size={16} /> Close
      </button>
      {discardCandidate && (
        <div className="absolute inset-0 z-10 flex items-end rounded-t-[28px] bg-black/60 p-4">
          <div className="w-full rounded-2xl border border-border bg-panel p-4 text-center">
            <h3 className="text-base font-extrabold">Discard this change?</h3>
            <p className="mt-2 text-sm text-muted">It won't be saved.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setDiscardCandidate(null)} className="min-h-11 rounded-2xl border border-border text-sm font-bold text-muted">Cancel</button>
              <button onClick={confirmDiscard} className="min-h-11 rounded-2xl bg-red-500 text-sm font-extrabold text-white">Discard</button>
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function OperationIcon({ type }) {
  const Icon = type.includes("Booking") ? CalendarDays : type.includes("Expense") ? Receipt : WalletCards;
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/5 text-accent"><Icon size={18} /></span>;
}

function operationDescription(failure, formatCurrency) {
  const { type, payload } = failure;
  const booking = payload.booking || {};
  const expense = payload.row || payload.changes || {};
  if (type === "updateBooking") return `Update booking — ${booking.guestName || "Guest"}, ${formatDateRange(booking)}`;
  if (type === "addBooking") return `New booking — ${booking.guestName || "Guest"}`;
  if (type === "deleteBooking") return `Delete booking — ${payload.guestName || "Reservation"}`;
  if (type === "addExpense") return `New expense — ${expense.description || "Expense"}, ${formatCurrency?.(expense.amount || 0) || expense.amount || 0}`;
  if (type === "updateExpense") return `Update expense — ${expense.description || "Expense"}, ${formatCurrency?.(expense.amount || 0) || expense.amount || 0}`;
  if (type === "deleteExpense") return `Delete expense — ${payload.description || "Expense"}${payload.amount !== undefined ? `, ${formatCurrency?.(payload.amount) || payload.amount}` : ""}`;
  if (type === "updateMonthlyCosts") return `Update monthly costs — ${payload.month || ""}`;
  return "Pending change";
}

function formatDateRange(booking) {
  if (!booking.checkIn || !booking.checkOut) return "dates unavailable";
  return `${dateLabel(booking.checkIn)} → ${dateLabel(booking.checkOut)}`;
}
