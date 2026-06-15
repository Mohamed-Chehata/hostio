import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdateBanner() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({ immediate: true });

  if (!needRefresh || dismissed) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed bottom-[88px] left-1/2 z-[72] flex min-h-14 w-[calc(100%-24px)] max-w-[366px] -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-panel px-4 py-3 text-white shadow-2xl"
    >
      <RefreshCw className="shrink-0 text-accent" size={18} />
      <p className="min-w-0 flex-1 text-sm font-extrabold">A new version is available</p>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="min-h-11 rounded-xl px-2 text-sm font-extrabold text-accent"
      >
        Refresh
      </button>
      <button
        type="button"
        aria-label="Dismiss update"
        onClick={() => setDismissed(true)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted"
      >
        <X size={17} />
      </button>
    </motion.aside>
  );
}
