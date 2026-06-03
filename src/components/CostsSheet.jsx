import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { Button, Input } from "./ui";
import { monthLabel } from "../lib/utils";

export function CostsSheet({ stats, currency, costLabels = { rent: "Rent", cleaning: "Cleaning" }, onClose, onSave }) {
  const [costs, setCosts] = useState({ rent: stats.rent, cleaning: stats.cleaning, expenses: stats.expenses });
  const [saving, setSaving] = useState(false);

  useEffect(() => setCosts({ rent: stats.rent, cleaning: stats.cleaning, expenses: stats.expenses }), [stats]);

  function set(field, value) {
    setCosts((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setSaving(true);
    setTimeout(() => onSave(Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, Number(value) || 0]))), 400);
  }

  return (
    <BottomSheet title="Monthly costs" description={`Update expenses for ${monthLabel(stats.month)}.`} onClose={onClose} externalClosing={saving}>
      <form className="space-y-4" onSubmit={submit}>
        {["rent", "cleaning", "expenses"].map((field) => (
          <label className="block" key={field}>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">{field === "rent" ? costLabels.rent : field === "cleaning" ? costLabels.cleaning : field}</span>
            <div className="relative">
              <span className="absolute left-4 top-3 text-sm font-bold text-accent">{currency.symbol}</span>
              <Input aria-label={field} className="pl-8" type="number" min="0" step="0.01" value={costs[field]} onChange={(event) => set(field, event.target.value)} />
            </div>
          </label>
        ))}
        <Button className="w-full py-4" type="submit">Save costs</Button>
      </form>
    </BottomSheet>
  );
}
