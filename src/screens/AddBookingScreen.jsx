import { useEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { CalendarPicker } from "../components/CalendarPicker";
import { MoneyInput, validateMoneyValue } from "../components/MoneyInput";
import { PaymentStatusControl } from "../components/PaymentStatusControl";
import { Button, Input } from "../components/ui";
import { cn, dateLabel, nightsBetween } from "../lib/utils";
import { payoutDateLabel } from "../utils/paymentStatus";

const blank = { guestName: "", checkIn: "", checkOut: "", revenue: "", rating: null, paymentOverride: null };

export function AddBookingScreen({ booking, onCheckConflict, onSave, onDelete, onCancelReservation, currency, embedded = false }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState([]);
  const [revenueError, setRevenueError] = useState("");
  const [dateConflict, setDateConflict] = useState(null);
  const [conflictVisible, setConflictVisible] = useState(false);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictShake, setConflictShake] = useState(0);
  const [shakeRound, setShakeRound] = useState(0);
  const conflictRequest = useRef(0);
  const conflictClearTimer = useRef(null);
  const nights = nightsBetween(form.checkIn, form.checkOut);

  useEffect(() => {
    if (!booking) {
      setForm(blank);
      return;
    }
    setForm({ ...booking, revenue: String(booking.revenue ?? "") });
  }, [booking]);

  useEffect(() => () => clearTimeout(conflictClearTimer.current), []);

  function set(field, value) {
    setError("");
    setInvalidFields((current) => current.filter((item) => item !== field));
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clearConflict() {
    setConflictVisible(false);
    clearTimeout(conflictClearTimer.current);
    conflictClearTimer.current = setTimeout(() => setDateConflict(null), 150);
  }

  async function updateDates(nextDates) {
    const nextNights = nightsBetween(nextDates.checkIn, nextDates.checkOut);
    const requestId = conflictRequest.current + 1;
    conflictRequest.current = requestId;
    setCheckingConflict(false);
    clearConflict();
    if (nextNights > 90) {
      setError("Maximum stay is 90 nights");
      setInvalidFields((current) => [...new Set([...current, "dates"])]);      
      return;
    }
    setError("");
    setInvalidFields((current) => current.filter((item) => item !== "dates"));
    const nextForm = {
      ...form,
      checkIn: nextDates.checkIn,
      checkOut: nextDates.checkOut
    };
    setForm((current) => ({
      ...current,
      checkIn: nextDates.checkIn,
      checkOut: nextDates.checkOut
    }));
    if (!nextDates.checkIn || !nextDates.checkOut || !onCheckConflict) return;

    setCheckingConflict(true);
    const conflict = await onCheckConflict(nextForm);
    if (conflictRequest.current !== requestId) return;
    setCheckingConflict(false);
    if (!conflict) return;
    clearTimeout(conflictClearTimer.current);
    setDateConflict(conflict);
    setInvalidFields((current) => [...new Set([...current, "dates"])]);
    requestAnimationFrame(() => setConflictVisible(true));
  }

  async function submit(event) {
    event.preventDefault();
    if (checkingConflict || dateConflict) {
      if (dateConflict) {
        setConflictVisible(true);
        setConflictShake((current) => current + 1);
      }
      return;
    }
    const revenue = Number(form.revenue);
    const nextRevenueError = validateMoneyValue(form.revenue, { revenue: true });
    const invalid = [
      (!form.guestName.trim() || form.guestName.trim().length > 200) && "guestName",
      (!form.checkIn || !form.checkOut || nights < 1 || nights > 90) && "dates",
      nextRevenueError && "revenue"
    ].filter(Boolean);
    if (invalid.length) {
      setRevenueError(nextRevenueError);
      setInvalidFields(invalid);
      setShakeRound((current) => current + 1);
      setError(nights > 90 ? "Maximum stay is 90 nights" : "Add the guest, valid dates, and revenue to continue.");
      return;
    }
    const result = await onSave({ ...form, id: form.id || `booking-${Date.now()}`, guestName: form.guestName.trim(), revenue, nights });
    if (result?.conflict) {
      setDateConflict(result.conflict);
      setConflictVisible(true);
      setInvalidFields((current) => [...new Set([...current, "dates"])]);
      setConflictShake((current) => current + 1);
    }
  }

  return (
    <main className={embedded ? "" : "px-5 pb-28 pt-6"}>
      {!embedded && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{booking ? "Manage reservation" : "New reservation"}</p>}
      {!embedded && <h1 className="text-2xl font-extrabold">{booking ? "Edit booking" : "Add booking"}</h1>}

      <form onSubmit={submit} className={cn("space-y-5", !embedded && "mt-7")}>
        <Field key={`guest-${shakeRound}`} label="Guest name" invalid={invalidFields.includes("guestName")}><Input maxLength={200} placeholder="Guest name" value={form.guestName} onChange={(event) => set("guestName", event.target.value)} /></Field>
        <Field key={`dates-${shakeRound}`} label="Stay dates" invalid={invalidFields.includes("dates")} container>
          <CalendarPicker invalid={invalidFields.includes("dates")} checkIn={form.checkIn} checkOut={form.checkOut} onChange={updateDates} />
          {form.bookingStatus !== "cancelled" && form.checkIn && form.checkOut && (
            <div className="mt-3 flex animate-expense-entry items-start gap-2 text-[13px] font-semibold leading-5 text-muted">
              <CalendarClock className="mt-0.5 shrink-0 text-accent" size={15} />
              <span>Payment will be marked received automatically on {payoutDateLabel(form.checkOut)}</span>
            </div>
          )}
          {form.bookingStatus !== "cancelled" && booking && form.checkIn && form.checkOut && (
            <div className="mt-3 flex animate-expense-entry items-center justify-between rounded-2xl bg-panel px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Payment status</span>
              <PaymentStatusControl booking={form} onChange={(paymentOverride) => set("paymentOverride", paymentOverride)} />
            </div>
          )}
          {dateConflict && (
            <p key={conflictShake} className={cn("mt-2 text-sm font-semibold text-[#EF4444] transition-[opacity,transform] duration-150 ease-in", conflictVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0", conflictShake > 0 && "animate-booking-conflict")}>
              These dates overlap with {dateConflict.guestName}'s booking ({dateLabel(dateConflict.checkIn)} → {dateLabel(dateConflict.checkOut)})
            </p>
          )}
        </Field>
        <div className="rounded-2xl bg-panel p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Stay length</p>
          <p className="mt-1 text-xl font-extrabold text-accent">{nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : "Select dates"}</p>
        </div>
        <Field key={`revenue-${shakeRound}`} label="Revenue" invalid={invalidFields.includes("revenue")}>
          <MoneyInput
            ariaLabel="Revenue"
            currency={currency}
            revenue
            value={form.revenue}
            onChange={(value) => set("revenue", value)}
            externalError={revenueError}
            onValidityChange={(_, message) => setRevenueError(message)}
          />
        </Field>
        {error && <p className="text-sm font-semibold text-orange-300">{error}</p>}
        <Button disabled={checkingConflict || Boolean(dateConflict)} className="w-full py-4 transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40" type="submit">{booking ? "Save changes" : "Save booking"}</Button>
        {booking?.bookingStatus !== "cancelled" && onCancelReservation && <button type="button" className="w-full py-2 text-sm font-bold text-red-400 transition-colors hover:text-red-300" onClick={() => onCancelReservation(booking)}>Cancel reservation</button>}
        {booking && onDelete && <button type="button" className="w-full py-2 text-sm font-bold text-red-400/80 transition-colors hover:text-red-300" onClick={onDelete}>Delete</button>}
      </form>
    </main>
  );
}

function Field({ label, children, container = false, invalid = false }) {
  const Component = container ? "div" : "label";
  return <Component className={cn("block", invalid && "animate-field-shake")}><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">{label}</span>{children}</Component>;
}
