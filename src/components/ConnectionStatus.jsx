import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

export function ConnectionStatus({ isOnline, isSyncing }) {
  const previousOnline = useRef(isOnline);
  const [phase, setPhase] = useState(isOnline ? "hidden" : "offline");

  useEffect(() => {
    let pulseTimer;
    let hideTimer;

    if (!isOnline) {
      setPhase("offline");
    } else if (!previousOnline.current) {
      setPhase("reconnected");
      pulseTimer = setTimeout(() => setPhase("leaving"), 300);
      hideTimer = setTimeout(() => setPhase("hidden"), 450);
    }
    previousOnline.current = isOnline;

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(hideTimer);
    };
  }, [isOnline]);

  if (phase !== "hidden") {
    const reconnected = phase === "reconnected";
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-muted ${phase === "leaving" ? "animate-connection-exit" : "animate-connection-enter"}`}>
        <span className={`h-2 w-2 rounded-full ${reconnected ? "animate-reconnected-dot bg-emerald-400" : "animate-offline-dot bg-muted"}`} />
        {reconnected ? "Online" : "Offline"}
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <LoaderCircle className="animate-spin" size={12} /> Syncing...
      </span>
    );
  }
  return null;
}
