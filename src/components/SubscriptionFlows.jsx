import { useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { PLANS } from "../config/pricing";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./ui";

export function PropertyLimitSheet({ planId, onUpgrade, onClose }) {
  const plan = PLANS[planId];
  return (
    <BottomSheet title="Property limit reached" onClose={onClose}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent"><LockKeyhole size={23} /></div>
        <p className="mt-4 text-sm leading-6 text-muted">Your {plan?.name || "current"} plan allows up to {plan?.propertyLimit || 0} properties. Upgrade to add more.</p>
        <Button onClick={onUpgrade} className="mt-6 w-full py-4">Upgrade</Button>
      </div>
    </BottomSheet>
  );
}

export function LockedPropertyBanner({ onUpgrade }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
      <LockKeyhole className="shrink-0 text-accent" size={18} />
      <p className="flex-1 font-bold">This property is locked. Upgrade your plan to unlock it.</p>
      <button onClick={onUpgrade} className="min-h-11 text-xs font-extrabold text-accent">Upgrade</button>
    </div>
  );
}

export function PropertySelectionScreen({ properties, planId, onConfirm }) {
  const plan = PLANS[planId];
  const limit = plan?.propertyLimit || 0;
  const [selected, setSelected] = useState(() => new Set(properties.slice(0, limit).map((property) => property.id)));
  const [submitting, setSubmitting] = useState(false);

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < limit) next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size !== limit || submitting) return;
    setSubmitting(true);
    const saved = await onConfirm([...selected]);
    if (!saved) setSubmitting(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-[390px] bg-app px-5 py-8 text-white">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">Plan update</p>
      <h1 className="mt-3 text-3xl font-extrabold">Choose which properties stay active</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Your {plan?.name} plan allows up to {limit} properties. You have {properties.length}. Select {limit} to keep active — the rest will be locked until you upgrade again.</p>
      <p className="mt-6 text-sm font-extrabold text-accent">{selected.size} of {limit} selected</p>
      <div className="mt-3 space-y-2">
        {properties.map((property) => {
          const checked = selected.has(property.id);
          return (
            <button key={property.id} onClick={() => toggle(property.id)} className={`flex min-h-14 w-full items-center rounded-2xl border px-4 text-left ${checked ? "border-accent bg-accent/10" : "border-border bg-panel"}`}>
              <span className="flex-1 truncate text-sm font-extrabold">{property.name}</span>
              <span className={`grid h-6 w-6 place-items-center rounded-full ${checked ? "bg-accent text-ink" : "border border-border"}`}>{checked && <Check size={15} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </div>
      <Button onClick={confirm} disabled={selected.size !== limit || submitting} className="mt-7 w-full py-4 disabled:opacity-40">{submitting ? "Saving..." : "Confirm"}</Button>
    </main>
  );
}
