import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, CircleDollarSign } from "lucide-react";
import { MonthNavigator } from "../components/MonthNavigator";
import { Skeleton } from "../components/Skeleton";
import { BestWorstCards, blankStats, monthRange, MonthlySummaryTable, StatsChartCard } from "../components/StatsOverview";
import { Card } from "../components/ui";
import { currentMonthKey, moveMonth } from "../utils/monthUtils";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { OfflineUnavailable } from "../components/OfflineUnavailable";
import { PullToRefresh } from "../components/PullToRefresh";

function halfYearStart(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}-${monthNumber <= 6 ? "01" : "07"}`;
}

export function AllPropertiesScreen({
  properties,
  monthsData,
  isMonthLoading,
  isMonthInitialized,
  fetchMonth,
  refreshMonth,
  formatCurrency,
  isDarkTheme,
  isOnline = true,
  isSyncing = false,
  onBack
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const currentWindowStart = useMemo(() => halfYearStart(currentMonthKey()), []);
  const visibleWindowStart = useMemo(() => moveMonth(currentWindowStart, pageIndex * -6), [currentWindowStart, pageIndex]);
  const visibleMonths = useMemo(() => Array.from({ length: 6 }, (_, index) => moveMonth(visibleWindowStart, index)), [visibleWindowStart]);
  const propertyKey = properties.map((property) => `${property.id}:${property.name}`).join("|");

  useEffect(() => {
    visibleMonths.forEach((month) => fetchMonth(month));
  }, [propertyKey, visibleMonths]);

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => properties.some((property) => property.id === id))));
  }, [properties]);

  const effectiveIds = useMemo(
    () => selectedIds.size ? selectedIds : new Set(properties.map((property) => property.id)),
    [properties, selectedIds]
  );
  const combinedStats = useMemo(() => visibleMonths.map((month) => {
    const rows = (monthsData[month]?.propertyStats || []).filter((item) => effectiveIds.has(item.property.id));
    if (!rows.length) return blankStats(month);
    const occupancyNights = rows.reduce((total, item) => total + item.occupancyNights, 0);
    return {
      month,
      totalRevenue: rows.reduce((total, item) => total + item.totalRevenue, 0),
      unpaidRevenue: rows.reduce((total, item) => total + item.unpaidRevenue, 0),
      occupancyNights,
      occupancyRate: Math.min(100, Math.round(occupancyNights / (daysInMonth(month) * Math.max(1, rows.length)) * 100)),
      netRevenue: rows.reduce((total, item) => total + item.netRevenue, 0)
    };
  }), [effectiveIds, monthsData, visibleMonths]);
  const summary = useMemo(() => {
    const totalAvailableNights = visibleMonths.reduce((total, month) => total + daysInMonth(month) * Math.max(1, effectiveIds.size), 0);
    const occupancyNights = combinedStats.reduce((total, item) => total + item.occupancyNights, 0);
    return {
      totalRevenue: combinedStats.reduce((total, item) => total + item.totalRevenue, 0),
      unpaidRevenue: combinedStats.reduce((total, item) => total + item.unpaidRevenue, 0),
      occupancyNights,
      occupancyRate: Math.min(100, Math.round(occupancyNights / Math.max(1, totalAvailableNights) * 100)),
      netRevenue: combinedStats.reduce((total, item) => total + item.netRevenue, 0)
    };
  }, [combinedStats, effectiveIds.size, visibleMonths]);
  const showSkeleton = visibleMonths.some((month) => !isMonthInitialized(month) || isMonthLoading(month));

  function toggleProperty(id) {
    setSelectedIds((current) => {
      if (!current.size) return new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PullToRefresh onRefresh={() => Promise.all(visibleMonths.map((month) => refreshMonth(month)))}>
    <main className="px-5 pb-12 pt-6">
      <header className="flex items-center gap-3">
        <button aria-label="Back to Dashboard" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-panel text-muted">
          <ArrowLeft size={19} />
        </button>
        <h1 className="text-2xl font-extrabold">All Properties</h1>
      </header>
      <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />

      <MonthNavigator
        className="my-6 rounded-2xl bg-panel p-2"
        label={monthRange(combinedStats)}
        nextDisabled={pageIndex === 0}
        previousLabel="Previous six months"
        nextLabel="Next six months"
        onPrevious={() => setPageIndex((current) => current + 1)}
        onNext={() => setPageIndex((current) => Math.max(0, current - 1))}
      />

      {!isOnline && !Object.keys(monthsData).length ? <OfflineUnavailable onRetry={async () => {
        if (!navigator.onLine) return false;
        const results = await Promise.all(visibleMonths.map((month) => fetchMonth(month)));
        return results.some(Boolean);
      }} /> : showSkeleton ? <Skeleton className="h-[214px]" /> : (
        <Card className="relative min-h-[214px] overflow-hidden bg-accent p-5 text-ink">
          <CircleDollarSign className="absolute -right-5 -top-7 opacity-20" size={130} strokeWidth={1.4} />
          <p className="relative text-xs font-bold uppercase tracking-widest opacity-70">Total net revenue</p>
          <div className="relative mt-2 flex items-end gap-2">
            <h2 className="text-4xl font-extrabold tracking-tight">{formatCurrency(summary.netRevenue)}</h2>
            <ArrowUpRight className="mb-1" size={22} strokeWidth={3} />
          </div>
          <div className="relative mt-7 grid grid-cols-3 gap-2 border-t border-black/15 pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase opacity-60">Revenue</p>
              <p className="mt-1 text-sm font-extrabold">{formatCurrency(summary.totalRevenue)}</p>
              <p className="mt-0.5 min-h-[13px] text-[10px] font-extrabold text-ink/55">{summary.unpaidRevenue > 0 ? `${formatCurrency(summary.unpaidRevenue)} pending/unpaid` : ""}</p>
            </div>
            <div><p className="text-[10px] font-bold uppercase opacity-60">Occupancy</p><p className="mt-1 text-sm font-extrabold">{summary.occupancyRate}%</p></div>
            <div><p className="text-[10px] font-bold uppercase opacity-60">Nights</p><p className="mt-1 text-sm font-extrabold">{summary.occupancyNights}</p></div>
          </div>
        </Card>
      )}

      <div className="-mx-5 mt-5 overflow-x-auto px-5 pb-2">
        <div className="flex w-max gap-2">
          <FilterChip label="All" selected={selectedIds.size === 0} onClick={() => setSelectedIds(new Set())} />
          {properties.map((property) => <FilterChip key={property.id} label={property.name} selected={selectedIds.has(property.id)} onClick={() => toggleProperty(property.id)} />)}
        </div>
      </div>

      {showSkeleton ? (
        <>
          <Skeleton className="mt-5 h-[292px]" />
          <div className="mt-3 grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          <Skeleton className="mt-7 h-[220px]" />
        </>
      ) : (
        <>
          <StatsChartCard stats={combinedStats} formatCurrency={formatCurrency} isDarkTheme={isDarkTheme} />
          <BestWorstCards stats={combinedStats} formatCurrency={formatCurrency} />
          <MonthlySummaryTable stats={combinedStats} formatCurrency={formatCurrency} />
        </>
      )}
    </main>
    </PullToRefresh>
  );
}

function FilterChip({ label, selected, onClick }) {
  return <button onClick={onClick} className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-extrabold transition ${selected ? "bg-accent text-ink" : "bg-panel text-white"}`}>{label}</button>;
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}
