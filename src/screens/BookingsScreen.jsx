import { CalendarX2, ChevronDown } from "lucide-react";
import { BookingCard } from "../components/BookingCard";
import { MonthNavigator } from "../components/MonthNavigator";
import { Skeleton } from "../components/Skeleton";
import { monthKey, monthLabel, moveMonth } from "../utils/monthUtils";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { OfflineUnavailable } from "../components/OfflineUnavailable";
import { LockedPropertyBanner } from "../components/SubscriptionFlows";

export function BookingsScreen({ month, setMonth, activePropertyName = "My Property", onOpenProperties, bookings, locked = false, onUpgrade, isLoading = false, isInitialized = false, offlineUnavailable = false, isOnline = true, isSyncing = false, onRetry, formatCurrency, onSelect, onRequestDelete, onPaymentOverride, openSwipeId, onOpenSwipe, onCloseSwipe, deletionStages }) {
  const visible = bookings.filter((booking) => monthKey(booking.checkIn) === month).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const showSkeleton = !isInitialized || isLoading;

  return (
    <main className="px-5 pb-24 pt-6">
      <button onClick={onOpenProperties} className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-2xl px-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        <span className="max-w-[240px] truncate">{activePropertyName}</span>
        <ChevronDown size={13} />
      </button>
      <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />
      <h1 className="text-2xl font-extrabold">Bookings</h1>
      {locked && <div className="mt-4"><LockedPropertyBanner onUpgrade={onUpgrade} /></div>}

      <MonthNavigator className="my-6 rounded-2xl bg-panel p-2" label={monthLabel(month)} onPrevious={() => setMonth(moveMonth(month, -1))} onNext={() => setMonth(moveMonth(month, 1))} />

      {offlineUnavailable ? <OfflineUnavailable onRetry={onRetry} /> : showSkeleton ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => <BookingCardSkeleton key={item} />)}
        </div>
      ) : isInitialized && visible.length ? (
        <>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{visible.length} reservations</p>
          <div className="space-y-2">{visible.map((booking) => <BookingCard key={booking.id} booking={booking} formatCurrency={formatCurrency} onClick={() => onSelect(booking)} onRequestDelete={onRequestDelete} onPaymentOverride={onPaymentOverride} isOpen={openSwipeId === booking.id} onOpenSwipe={onOpenSwipe} onCloseSwipe={onCloseSwipe} deletionStage={deletionStages[booking.id]} readOnly={locked} />)}</div>
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

function BookingCardSkeleton() {
  return (
    <div className="skeleton-shimmer h-[118px] rounded-2xl p-4">
      <Skeleton className="h-full rounded-xl" />
    </div>
  );
}
