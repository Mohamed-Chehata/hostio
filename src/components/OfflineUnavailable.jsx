import { useState } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "../lib/utils";

export function OfflineUnavailable({ onRetry }) {
  const [shaking, setShaking] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    const loaded = navigator.onLine && await onRetry?.();
    setRetrying(false);
    if (loaded) return;
    setShaking(false);
    requestAnimationFrame(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 150);
    });
  }

  return (
    <div className="mt-6 flex min-h-44 flex-col items-center justify-center rounded-2xl border border-border bg-panel px-5 text-center text-muted">
      <WifiOff size={25} />
      <h2 className="mt-3 text-base font-extrabold text-white">No connection</h2>
      <p className="mt-1 text-sm font-semibold">Connect to the internet to load this data</p>
      <button
        type="button"
        onClick={retry}
        disabled={retrying}
        className={cn(
          "mt-4 min-h-11 rounded-2xl border border-border px-5 text-sm font-bold text-muted transition active:border-accent disabled:opacity-60",
          shaking && "animate-offline-retry-shake"
        )}
      >
        {retrying ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
