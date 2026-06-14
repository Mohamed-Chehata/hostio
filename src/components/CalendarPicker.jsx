import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { MonthNavigator } from "./MonthNavigator";
import { cn, dateLabel } from "../lib/utils";
import { currentMonthKey, monthLabel, moveMonth } from "../utils/monthUtils";

const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CalendarPicker({ checkIn, checkOut, onChange, invalid = false }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(`${checkIn || `${currentMonthKey()}-01`}T00:00:00`));
  const [draftStart, setDraftStart] = useState(checkIn);
  const [draftEnd, setDraftEnd] = useState(checkOut);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setDraftStart(checkIn);
    setDraftEnd(checkOut);
  }, [checkIn, checkOut]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => formatDate(year, month, index + 1))];
  }, [visibleMonth]);

  function chooseDate(date) {
    if (!draftStart || draftEnd || date <= draftStart) {
      setDraftStart(date);
      setDraftEnd("");
      return;
    }
    setDraftEnd(date);
  }

  function applyDates() {
    if (!draftStart || !draftEnd) return;
    onChange({ checkIn: draftStart, checkOut: draftEnd });
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 400);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("field-control flex w-full items-center justify-between rounded-2xl border border-border bg-panel px-4 py-3 text-left text-sm transition-colors duration-150", invalid && "animate-field-shake border-[#EF4444] border-b-[#EF4444]")}>
        <span className={checkIn && checkOut ? "text-white" : "text-muted"}>
          {checkIn && checkOut ? `${dateLabel(checkIn)} → ${dateLabel(checkOut)}` : "Select check-in and checkout"}
        </span>
        <CalendarDays size={17} className="text-accent" />
      </button>
      {open && (
        <BottomSheet title="Select dates" description="Tap a check-in date, then choose checkout." onClose={() => setOpen(false)} externalClosing={closing}>
          <MonthNavigator
            className="rounded-2xl bg-white/5 p-2"
            label={monthLabel(`${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`)}
            labelClassName="min-w-0"
            arrowClassName="h-9 min-h-9 w-9 rounded-xl bg-transparent"
            previousLabel="Previous calendar month"
            nextLabel="Next calendar month"
            onPrevious={() => setVisibleMonth((current) => moveMonth(current, -1))}
            onNext={() => setVisibleMonth((current) => moveMonth(current, 1))}
          />
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day, index) => <span key={`${day}-${index}`} className="py-1 text-[10px] font-bold text-muted">{day}</span>)}
            {days.map((date, index) => date ? (
              <button
                type="button"
                aria-label={date}
                key={date}
                onClick={() => chooseDate(date)}
                className={cn(
                  "min-h-11 rounded-xl text-xs font-bold transition-colors duration-200",
                  date === draftStart || date === draftEnd ? "bg-accent text-ink" : "text-white",
                  draftStart && draftEnd && date > draftStart && date < draftEnd && "bg-accent/15 text-accent"
                )}
              >
                {Number(date.slice(-2))}
              </button>
            ) : <span key={`empty-${index}`} />)}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-xs font-semibold">
            <span className={draftStart ? "text-white" : "text-muted"}>{draftStart ? dateLabel(draftStart) : "Check-in"}</span>
            <span className="text-muted">→</span>
            <span className={draftEnd ? "text-white" : "text-muted"}>{draftEnd ? dateLabel(draftEnd) : "Checkout"}</span>
          </div>
          <button type="button" disabled={!draftStart || !draftEnd} onClick={applyDates} className="mt-3 w-full rounded-2xl bg-accent py-3.5 text-sm font-extrabold text-ink disabled:opacity-40">Apply dates</button>
        </BottomSheet>
      )}
    </>
  );
}
