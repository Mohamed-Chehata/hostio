import { AlertTriangle, Check } from "lucide-react";

export function Toast({ message, closing, type = "success" }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <div className={`${closing ? "animate-toast-out" : "animate-toast-in"} fixed bottom-3 left-1/2 z-[70] flex min-h-11 w-[calc(100%-24px)] max-w-[366px] -translate-x-1/2 items-center gap-3 rounded-2xl ${isError ? "bg-[#7F1D1D]" : "bg-emerald-500"} px-4 py-3 text-sm font-extrabold text-white shadow-2xl`}>
      {isError ? <AlertTriangle size={18} strokeWidth={3} /> : <Check size={18} strokeWidth={3} />} {message}
    </div>
  );
}
