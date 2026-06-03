import { BarChart3, CalendarDays, House, Plus, Receipt } from "lucide-react";
import { cn } from "../lib/utils";

const items = [
  { id: "dashboard", label: "Dashboard", icon: House },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "add", label: "Add Booking", icon: Plus },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "stats", label: "Stats", icon: BarChart3 }
];

export function BottomNav({ active, onNavigate }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[390px] -translate-x-1/2 items-center justify-around border-t border-white/5 bg-[#101214]/95 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} aria-label={label} onClick={() => onNavigate(id)} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 text-[10px] font-semibold", id === "add" ? "justify-start" : "", active === id ? "text-accent" : "text-muted")}>
          {id === "add" ? (
            <span className="grid h-12 w-12 -translate-y-2.5 place-items-center rounded-full bg-accent text-ink shadow-[0_10px_24px_rgba(255,211,88,0.24)] transition-transform active:scale-[0.97]">
              <Icon size={22} strokeWidth={3} />
            </span>
          ) : (
            <>
              <Icon size={18} strokeWidth={active === id ? 2.7 : 2} />
              <span>{label}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
}
