import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { CalendarPicker } from "../components/CalendarPicker";
import { Button, Input } from "../components/ui";
import { cn, nightsBetween } from "../lib/utils";

const blank = { guestName: "", checkIn: "", checkOut: "", revenue: "", rating: null, status: "Paid" };

export function AddBookingScreen({ booking, onCancel, onSave, onDelete, currency, embedded = false }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [invalidFields, setInvalidFields] = useState([]);
  const [shakeRound, setShakeRound] = useState(0);
  const nights = nightsBetween(form.checkIn, form.checkOut);

  useEffect(() => setForm(booking || blank), [booking]);

  function set(field, value) {
    setError("");
    setInvalidFields((current) => current.filter((item) => item !== field));
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const invalid = [
      (!form.guestName.trim() || form.guestName.trim().length > 200) && "guestName",
      (!form.checkIn || !form.checkOut || nights < 1) && "dates",
      (!form.revenue || !Number.isFinite(Number(form.revenue)) || Number(form.revenue) < 0) && "revenue",
      (form.rating !== null && (Number(form.rating) < 1 || Number(form.rating) > 5)) && "rating"
    ].filter(Boolean);
    if (invalid.length) {
      setInvalidFields(invalid);
      setShakeRound((current) => current + 1);
      setError("Add the guest, valid dates, and revenue to continue.");
      return;
    }
    onSave({ ...form, id: form.id || `booking-${Date.now()}`, guestName: form.guestName.trim(), revenue: Number(form.revenue), nights });
  }

  return (
    <main className={embedded ? "" : "px-5 pb-28 pt-6"}>
      {!embedded && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{booking ? "Manage reservation" : "New reservation"}</p>}
      {!embedded && <h1 className="text-2xl font-extrabold">{booking ? "Edit booking" : "Add booking"}</h1>}

      <form onSubmit={submit} className={cn("space-y-5", !embedded && "mt-7")}>
        <Field key={`guest-${shakeRound}`} label="Guest name" invalid={invalidFields.includes("guestName")}><Input maxLength={200} placeholder="Guest name" value={form.guestName} onChange={(event) => set("guestName", event.target.value)} /></Field>
        <Field key={`dates-${shakeRound}`} label="Stay dates" invalid={invalidFields.includes("dates")} container><CalendarPicker invalid={invalidFields.includes("dates")} checkIn={form.checkIn} checkOut={form.checkOut} onChange={({ checkIn, checkOut }) => { set("dates", ""); setForm((current) => ({ ...current, checkIn, checkOut })); }} /></Field>
        <div className="rounded-2xl bg-panel p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Stay length</p>
          <p className="mt-1 text-xl font-extrabold text-accent">{nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : "Select dates"}</p>
        </div>
        <Field key={`revenue-${shakeRound}`} label="Revenue" invalid={invalidFields.includes("revenue")}>
          <div className="relative"><span className="absolute left-4 top-3 text-sm font-bold text-accent">{currency.symbol}</span><Input className="pl-8" type="number" min="0" step="0.01" placeholder="0" value={form.revenue} onChange={(event) => set("revenue", event.target.value)} /></div>
        </Field>
        <Field label="Rating (optional)">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => <button type="button" aria-label={`${rating} star rating`} key={rating} onClick={() => set("rating", rating)} className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-panel transition-colors duration-200", rating <= form.rating ? "text-accent" : "text-muted")}><Star size={17} fill={rating <= form.rating ? "currentColor" : "none"} /></button>)}
          </div>
        </Field>
        <Field label="Payment status">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-panel p-1.5">
            {["Paid", "Unpaid"].map((status) => <button type="button" key={status} onClick={() => set("status", status)} className={cn("min-h-11 rounded-xl py-2.5 text-sm font-bold transition-colors duration-200", form.status === status ? "bg-accent text-ink" : "text-muted")}>{status}</button>)}
          </div>
        </Field>
        {error && <p className="text-sm font-semibold text-orange-300">{error}</p>}
        <Button className="w-full py-4" type="submit">{booking ? "Save changes" : "Save booking"}</Button>
        {booking && onDelete && <button type="button" className="w-full py-2 text-sm font-bold text-red-400 transition-colors hover:text-red-300" onClick={onDelete}>Delete</button>}
      </form>
    </main>
  );
}

function Field({ label, children, container = false, invalid = false }) {
  const Component = container ? "div" : "label";
  return <Component className={cn("block", invalid && "animate-field-shake")}><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">{label}</span>{children}</Component>;
}
