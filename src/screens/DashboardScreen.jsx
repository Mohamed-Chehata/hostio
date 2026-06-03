import { useState } from "react";
import { ArrowUpRight, Building2, ChevronDown, CircleDollarSign, LogOut, Settings2, Sparkles, WalletCards } from "lucide-react";
import { BookingCard } from "../components/BookingCard";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Card } from "../components/ui";
import { monthLabel } from "../lib/utils";

export function DashboardScreen({ onNavigate, onSignOut, onOpenProperties, activePropertyName = "My Property", onEditCosts, onEditBooking, onRequestDelete, onToggleStatus, openSwipeId, onOpenSwipe, onCloseSwipe, onFirstSwipe, deletionStages, revenueAnimation, revenueDirection, stats, bookings, costLabels = { rent: "Rent", cleaning: "Cleaning" }, formatCurrency }) {
  const [profileOpen, setProfileOpen] = useState(false);
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
          <h1 className="text-2xl font-extrabold">{monthLabel(stats.month)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Open settings" onClick={() => onNavigate("settings")} className="grid h-10 w-10 place-items-center rounded-2xl bg-panel text-muted">
            <Settings2 size={18} />
          </button>
          <div className="relative">
            <button aria-label="Open profile menu" onClick={() => setProfileOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-sm font-extrabold text-ink">MH</button>
            {profileOpen && (
              <div className="absolute right-0 top-12 z-30 w-36 rounded-2xl border border-white/10 bg-[#202020] p-1 shadow-2xl">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onSignOut();
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-red-200 transition hover:bg-white/5"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Card className="relative overflow-hidden bg-accent p-5 text-ink">
        <CircleDollarSign className="absolute -right-5 -top-7 opacity-20" size={130} strokeWidth={1.4} />
        <p className="relative text-xs font-bold uppercase tracking-widest opacity-70">Net revenue</p>
        <div className="relative mt-2 flex items-end gap-2">
          <h2 className="text-4xl font-extrabold tracking-tight"><AnimatedNumber value={stats.netRevenue} direction={revenueDirection} animationKey={revenueAnimation?.id} previousValue={revenueAnimation?.previousNetRevenue} format={formatCurrency} /></h2>
          <ArrowUpRight className="mb-1" size={22} strokeWidth={3} />
        </div>
        <div className="relative mt-7 grid grid-cols-3 gap-2 border-t border-black/15 pt-4">
          <div><p className="text-[10px] font-bold uppercase opacity-60">Revenue</p><p className="mt-1 text-sm font-extrabold"><AnimatedNumber value={stats.totalRevenue} direction={revenueDirection} animationKey={revenueAnimation?.id} previousValue={revenueAnimation?.previousTotalRevenue} format={formatCurrency} /></p></div>
          <div><p className="text-[10px] font-bold uppercase opacity-60">Occupancy</p><p className="mt-1 text-sm font-extrabold">{stats.occupancyRate}%</p></div>
          <div><p className="text-[10px] font-bold uppercase opacity-60">Nights</p><p className="mt-1 text-sm font-extrabold">{stats.occupancyNights}</p></div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {quickStats.map(({ label, amount, icon: Icon }) => (
          <button aria-label={`Edit ${label} costs`} className="text-left" key={label} onClick={onEditCosts}>
            <Card className="p-3 transition hover:bg-white/[0.09]">
              <Icon className="text-accent" size={16} />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-1 text-xs font-extrabold">{formatCurrency(amount)}</p>
            </Card>
          </button>
        ))}
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Recent bookings</h2>
          <button onClick={() => onNavigate("bookings")} className="text-xs font-bold text-accent">See all</button>
        </div>
        <div className="space-y-2">{recent.map((booking) => <BookingCard key={booking.id} booking={booking} formatCurrency={formatCurrency} compact onClick={() => onEditBooking(booking)} onRequestDelete={onRequestDelete} onToggleStatus={onToggleStatus} isOpen={openSwipeId === booking.id} onOpenSwipe={onOpenSwipe} onCloseSwipe={onCloseSwipe} onFirstSwipe={onFirstSwipe} deletionStage={deletionStages[booking.id]} />)}</div>
      </section>
    </main>
  );
}
