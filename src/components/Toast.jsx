import { AlertTriangle, Check, X } from "lucide-react";

export function Toast({ message, closing, type = "success", duration = 3000, persistent = false, toastKey, onDismiss }) {
  if (!message) return null;
  const styles = {
    error: { className: "bg-[#7F1D1D]", progress: "bg-red-500", icon: X },
    warning: { className: "bg-[#78350F]", progress: "bg-amber-400", icon: AlertTriangle },
    success: { className: "bg-[#14532D]", progress: "bg-green-400", icon: Check }
  };
  const current = styles[type] || styles.success;
  const Icon = current.icon;
  return (
    <button type="button" onClick={onDismiss} className={`${closing ? "animate-toast-out" : "animate-toast-in"} fixed bottom-[88px] left-1/2 z-[70] flex min-h-11 w-[calc(100%-24px)] max-w-[366px] -translate-x-1/2 overflow-hidden rounded-2xl ${current.className} px-4 py-3 text-left text-sm font-extrabold text-[#FFFFFF] shadow-2xl`}>
      <span className="flex items-center gap-3">
      <Icon size={18} strokeWidth={3} /> {message}
      </span>
      {!persistent && !closing && (
        <span key={toastKey} className={`toast-progress absolute bottom-0 left-0 h-0.5 ${current.progress}`} style={{ animationDuration: `${duration}ms` }} />
      )}
    </button>
  );
}
