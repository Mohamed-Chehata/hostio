import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { BookingCard } from "../components/BookingCard";
import { monthKey, monthLabel } from "../lib/utils";

function moveMonth(month, amount) {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function BookingsScreen({ month, setMonth, activePropertyName = "My Property", bookings, formatCurrency, onSelect, onRequestDelete, onToggleStatus, openSwipeId, onOpenSwipe, onCloseSwipe, onFirstSwipe, hasSeenSwipeHint, deletionStages }) {
  const visible = bookings.filter((booking) => monthKey(booking.checkIn) === month).sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return (
    <main className="px-5 pb-24 pt-6">
      <p className="mb-1 max-w-[240px] truncate text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{activePropertyName}</p>
      <h1 className="text-2xl font-extrabold">Bookings</h1>

      <div className="my-6 flex items-center justify-between rounded-2xl bg-panel p-2">
        <button aria-label="Previous month" onClick={() => setMonth(moveMonth(month, -1))} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-muted"><ChevronLeft size={18} /></button>
        <p className="text-sm font-bold">{monthLabel(month)}</p>
        <button aria-label="Next month" onClick={() => setMonth(moveMonth(month, 1))} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-muted"><ChevronRight size={18} /></button>
      </div>

      {visible.length ? (
        <>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{visible.length} reservations</p>
          <div className="space-y-2">{visible.map((booking, index) => <BookingCard key={booking.id} booking={booking} formatCurrency={formatCurrency} onClick={() => onSelect(booking)} onRequestDelete={onRequestDelete} onToggleStatus={onToggleStatus} isOpen={openSwipeId === booking.id} onOpenSwipe={onOpenSwipe} onCloseSwipe={onCloseSwipe} onFirstSwipe={onFirstSwipe} teachSwipe={index === 0 && !hasSeenSwipeHint} deletionStage={deletionStages[booking.id]} />)}</div>
        </>
      ) : (
        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-panel text-accent"><CalendarX2 size={34} /></div>
          <h2 className="mt-5 text-lg font-extrabold">No bookings yet</h2>
          <p className="mt-2 max-w-[230px] text-sm leading-6 text-muted">This month is wide open. Add a reservation when your next guest checks in.</p>
        </div>
      )}
    </main>
  );
}
