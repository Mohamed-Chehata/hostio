import { ArrowUpRight, Building2, CalendarDays, ChevronDown, CircleDollarSign, Clock3, Layers3, Settings2, Sparkles, WalletCards, X } from "lucide-react";
import { BookingCard } from "../components/BookingCard";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { MonthNavigator } from "../components/MonthNavigator";
import { Skeleton, SkeletonList } from "../components/Skeleton";
import { Card } from "../components/ui";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { OfflineUnavailable } from "../components/OfflineUnavailable";
import { LockedPropertyBanner } from "../components/SubscriptionFlows";
import { monthLabel } from "../utils/monthUtils";

export function DashboardScreen({ onNavigate, onOpenProperties, activePropertyName = "My Property", onMonthChange, onOpenExpenses, onSeeAllBookings, onEditBooking, onRequestDelete, onPaymentOverride, onRetry, onUpgrade, locked = false, onDismissTrialBanner, trialDaysRemaining, showTrialBanner = false, openSwipeId, onOpenSwipe, onCloseSwipe, deletionStages, revenueAnimation, revenueDirection, stats, bookings, isLoading = false, isInitialized = false, offlineUnavailable = false, isOnline = true, isSyncing = false, costLabels = { rent: "Rent", cleaning: "Cleaning" }, formatCurrency }) {
  const showSkeleton = !isInitialized || isLoading;
  const recent = [...bookings].sort((a, b) => b.checkIn.localeCompare(a.checkIn)).slice(0, 3);
  const quickStats = [
    { label: costLabels.rent, amount: stats.rent, icon: Building2 },
    { label: costLabels.cleaning, amount: stats.cleaning, icon: Sparkles },
    { label: "Expenses", amount: stats.expenses, icon: WalletCards }
  ];

  return (
    <main className="px-5 pb-28 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={onOpenProperties} className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-2xl px-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            <span className="max-w-[190px] truncate">{activePropertyName}</span>
            <ChevronDown size={13} />
          </button>
          <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />
          <MonthNavigator
            className="min-w-[256px]"
            label={<h1 className="text-2xl font-extrabold">{monthLabel(stats.month)}</h1>}
            labelClassName="min-w-[160px]"
            arrowClassName="bg-panel"
            previousLabel="Previous dashboard month"
            nextLabel="Next dashboard month"
            onPrevious={() => onMonthChange(-1)}
            onNext={() => onMonthChange(1)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Open All Properties" onClick={() => onNavigate("all-properties")} className="grid h-10 w-10 place-items-center rounded-2xl bg-panel text-muted">
            <Layers3 size={18} />
          </button>
          <button aria-label="Open settings" onClick={() => onNavigate("settings")} className="grid h-10 w-10 place-items-center rounded-2xl bg-panel text-muted">
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {locked && <LockedPropertyBanner onUpgrade={onUpgrade} />}
      {showTrialBanner && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs font-extrabold text-ink">
          <span className="flex-1">
            Your trial ends in {trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} —{" "}
            <button type="button" onClick={onUpgrade} className="underline underline-offset-2">Upgrade</button>
          </span>
          <button type="button" onClick={onDismissTrialBanner} aria-label="Dismiss trial reminder" className="grid h-11 w-11 shrink-0 place-items-center">
            <X size={16} />
          </button>
        </div>
      )}

      {offlineUnavailable && <OfflineUnavailable onRetry={onRetry} />}
      <div className={offlineUnavailable ? "hidden" : ""}>

      {showSkeleton ? (
        <Skeleton className="h-[190px]" />
      ) : <Card className="relative min-h-[214px] overflow-hidden bg-accent p-5 text-ink">
        <CircleDollarSign className="absolute -right-5 -top-7 opacity-20" size={130} strokeWidth={1.4} />
        <p className="relative text-xs font-bold uppercase tracking-widest opacity-70">Net revenue</p>
        <div className="relative mt-2 flex items-end gap-2">
          <h2 className="text-4xl font-extrabold tracking-tight"><AnimatedNumber value={stats.netRevenue} direction={revenueDirection} animationKey={revenueAnimation?.id} previousValue={revenueAnimation?.previousNetRevenue} format={formatCurrency} /></h2>
          <ArrowUpRight className="mb-1" size={22} strokeWidth={3} />
        </div>
        <div className="relative mt-7 grid grid-cols-3 gap-2 border-t border-black/15 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase opacity-60">Revenue</p>
            <p className="mt-1 text-sm font-extrabold"><AnimatedNumber value={stats.totalRevenue} direction={revenueDirection} animationKey={revenueAnimation?.id} previousValue={revenueAnimation?.previousTotalRevenue} format={formatCurrency} /></p>
            <p className="mt-0.5 min-h-[13px] text-[10px] font-extrabold text-ink/55">{Number(stats.unpaidRevenue || 0) > 0 ? `${formatCurrency(stats.unpaidRevenue)} pending/unpaid` : ""}</p>
          </div>
          <div><p className="text-[10px] font-bold uppercase opacity-60">Occupancy</p><p className="mt-1 text-sm font-extrabold">{stats.occupancyRate}%</p></div>
          <div><p className="text-[10px] font-bold uppercase opacity-60">Nights</p><p className="mt-1 text-sm font-extrabold">{stats.occupancyNights}</p></div>
        </div>
      </Card>}

      {showSkeleton ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-[92px]" />)}
        </div>
      ) : <div className="mt-4 grid grid-cols-3 gap-2">
        {quickStats.map(({ label, amount, icon: Icon }) => (
          <button aria-label={`Open ${label} expenses`} className="text-left" key={label} onClick={onOpenExpenses}>
            <Card className="p-3 transition hover:bg-white/[0.09]">
              <Icon className="text-accent" size={16} />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-1 text-xs font-extrabold">{formatCurrency(amount)}</p>
            </Card>
          </button>
        ))}
      </div>}

      {!showSkeleton && stats.pendingPayouts?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-extrabold">Pending payouts</h2>
          <div className="space-y-2">
            {stats.pendingPayouts.map((booking) => (
              <Card key={booking.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{booking.guestName}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-bold text-muted"><Clock3 size={12} /> Available {formatPayoutDate(booking.cancellationPayoutAvailableAt)}</p>
                </div>
                <p className="shrink-0 text-sm font-extrabold text-accent">{formatCurrency(booking.revenue)}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Recent bookings</h2>
          <button onClick={onSeeAllBookings} className="text-xs font-bold text-accent">See all</button>
        </div>
        {showSkeleton ? (
          <SkeletonList className="h-[94px]" />
        ) : isInitialized && recent.length ? (
          <div className="space-y-2">{recent.map((booking) => <BookingCard key={booking.id} booking={booking} formatCurrency={formatCurrency} compact onClick={() => onEditBooking(booking)} onRequestDelete={onRequestDelete} onPaymentOverride={onPaymentOverride} isOpen={openSwipeId === booking.id} onOpenSwipe={onOpenSwipe} onCloseSwipe={onCloseSwipe} deletionStage={deletionStages[booking.id]} readOnly={locked} />)}</div>
        ) : (
          <div className="rounded-2xl bg-panel px-4 py-7 text-center text-muted">
            <CalendarDays className="mx-auto text-accent" size={24} />
            <p className="mt-3 text-sm font-bold">No bookings this month</p>
          </div>
        )}
      </section>
      </div>
    </main>
  );
}

function formatPayoutDate(value) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
