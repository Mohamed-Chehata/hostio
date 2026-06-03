import { ArrowLeft, Check, Coins } from "lucide-react";
import { Card } from "../components/ui";

export function SettingsScreen({ currency, currencies, updateCurrency, onBack }) {
  return (
    <main className="px-5 pb-10 pt-6">
      <button onClick={onBack} className="mb-6 grid h-10 w-10 place-items-center rounded-2xl bg-panel text-muted"><ArrowLeft size={18} /></button>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Preferences</p>
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <Card className="mt-7 p-4">
        <Coins className="text-accent" size={20} />
        <h2 className="mt-4 text-base font-extrabold">Currency symbol</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Choose the symbol used for prices throughout Hostio.</p>
      </Card>
      <div className="mt-3 space-y-2">
        {Object.values(currencies).map((option) => (
          <button key={option.code} onClick={() => updateCurrency(option.code)} className="flex w-full items-center justify-between rounded-2xl bg-panel px-4 py-4 text-left text-sm font-bold">
            <span>{option.label}</span>
            {currency.code === option.code && <Check className="text-accent" size={18} />}
          </button>
        ))}
      </div>
    </main>
  );
}
