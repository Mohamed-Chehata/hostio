import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { AnimatedNumber } from "./AnimatedNumber";
import { cn } from "../lib/utils";

const payoutOptions = [
  { label: "0% — Full refund", value: 0 },
  { label: "50% — Partial", value: 50 },
  { label: "100% — No refund", value: 100 }
];

const availabilityOptions = [
  { label: "Immediately", value: 0 },
  { label: "After 24 hours", value: 24 }
];

export function CancellationPayoutSheet({ booking, formatCurrency, onCancel, onConfirm }) {
  const [percent, setPercent] = useState("");
  const [selectedPercent, setSelectedPercent] = useState(null);
  const [hours, setHours] = useState(0);
  const [selectedHours, setSelectedHours] = useState(0);
  const [saving, setSaving] = useState(false);
  const originalRevenue = Number(booking?.originalRevenue ?? booking?.revenue ?? 0);
  const parsedPercent = Number(percent);
  const hasPercent = percent !== "" && Number.isFinite(parsedPercent) && parsedPercent >= 0 && parsedPercent <= 100;
  const keptAmount = hasPercent ? originalRevenue * (parsedPercent / 100) : 0;
  const availableAt = useMemo(() => {
    const date = new Date();
    date.setHours(date.getHours() + Number(hours || 0));
    return date;
  }, [hours]);

  if (!booking) return null;

  function choosePercent(value) {
    setSelectedPercent(value);
    setPercent(String(value));
  }

  function updateCustomPercent(value) {
    const clean = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setSelectedPercent(null);
    setPercent(clean);
  }

  function chooseHours(value) {
    setSelectedHours(value);
    setHours(value);
  }

  function updateCustomHours(value) {
    const clean = value.replace(/\D/g, "");
    setSelectedHours(null);
    setHours(clean === "" ? "" : Number(clean));
  }

  async function confirm() {
    if (!hasPercent || saving) return;
    setSaving(true);
    const ok = await onConfirm({
      percent: Math.min(100, Math.max(0, parsedPercent)),
      hours: Math.max(0, Number(hours || 0)),
      availableAt
    });
    if (!ok) setSaving(false);
  }

  return (
    <BottomSheet title="Cancel this reservation?" description={booking.guestName} onClose={onCancel}>
      <div>
        <h2 className="text-xl font-extrabold">Cancellation payout</h2>
        <p className="mt-2 text-sm leading-6 text-muted">How much of the {formatCurrency(originalRevenue)} should be kept based on your cancellation policy?</p>

        <div className="mt-5 grid gap-2">
          {payoutOptions.map((option) => (
            <button key={option.value} type="button" onClick={() => choosePercent(option.value)} className={cn("rounded-2xl px-4 py-3 text-sm font-extrabold transition active:scale-[0.98]", selectedPercent === option.value ? "bg-accent text-ink" : "bg-panel text-white")}>
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Or enter custom %</span>
          <input value={percent} onChange={(event) => updateCustomPercent(event.target.value)} inputMode="decimal" className="field-control min-h-11 w-full rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-white placeholder:text-muted" placeholder="Custom percentage" />
        </label>

        <div className="mt-4 rounded-2xl bg-panel p-4 text-sm font-bold text-white">
          You'll keep <span className="text-accent"><AnimatedNumber value={keptAmount} direction="up" format={formatCurrency} /></span> of {formatCurrency(originalRevenue)}
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-accent" />
            <h3 className="text-sm font-extrabold">When will this amount be available?</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {availabilityOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => chooseHours(option.value)} className={cn("rounded-2xl px-4 py-3 text-sm font-extrabold transition active:scale-[0.98]", selectedHours === option.value ? "bg-accent text-ink" : "bg-panel text-white")}>
                {option.label}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Or enter custom hours</span>
            <input value={hours} onChange={(event) => updateCustomHours(event.target.value)} inputMode="numeric" className="field-control min-h-11 w-full rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-white placeholder:text-muted" placeholder="Hours" />
          </label>
          <p className="mt-3 text-sm font-bold text-muted">Available on <span className="text-white">{availableAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></p>
        </div>

        <button disabled={!hasPercent || saving} onClick={confirm} className="mt-6 w-full rounded-2xl bg-accent px-4 py-3.5 text-sm font-extrabold text-ink transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? "Cancelling..." : "Confirm cancellation"}
        </button>
      </div>
    </BottomSheet>
  );
}
