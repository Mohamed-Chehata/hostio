import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { MonthNavigator } from "../components/MonthNavigator";
import { Skeleton } from "../components/Skeleton";
import { BestWorstCards, blankStats, monthRange, MonthlySummaryTable, StatsChartCard } from "../components/StatsOverview";
import { Card } from "../components/ui";
import { currentMonthKey, moveMonth } from "../utils/monthUtils";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { OfflineUnavailable } from "../components/OfflineUnavailable";

function halfYearStart(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}-${monthNumber <= 6 ? "01" : "07"}`;
}

function monthsBetween(start, end) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth;
}

export function StatsScreen({ stats, activePropertyId = "", activePropertyName = "My Property", onOpenProperties, onRetry, formatCurrency, isDarkTheme = true, isLoading = false, isInitialized = false, isOnline = true, isSyncing = false }) {
  const sortedStats = useMemo(() => [...stats].sort((a, b) => a.month.localeCompare(b.month)), [stats]);
  const currentWindowStart = useMemo(() => halfYearStart(currentMonthKey()), []);
  const pageCount = useMemo(() => {
    const earliestWindowStart = halfYearStart(sortedStats[0]?.month || currentWindowStart);
    return Math.max(1, Math.floor(monthsBetween(earliestWindowStart, currentWindowStart) / 6) + 1);
  }, [currentWindowStart, sortedStats]);
  const [pageIndex, setPageIndex] = useState(0);
  const previousPropertyId = useRef(activePropertyId);
  const hasInitializedPage = useRef(false);
  const propertyChanged = Boolean(previousPropertyId.current && activePropertyId && previousPropertyId.current !== activePropertyId);
  const visibleWindowStart = useMemo(() => moveMonth(currentWindowStart, pageIndex * -6), [currentWindowStart, pageIndex]);
  const visibleStats = useMemo(() => {
    const statsByMonth = new Map(sortedStats.map((item) => [item.month, item]));
    return Array.from({ length: 6 }, (_, index) => {
      const month = moveMonth(visibleWindowStart, index);
      return statsByMonth.get(month) || blankStats(month);
    });
  }, [sortedStats, visibleWindowStart]);

  useEffect(() => {
    if (!activePropertyId || previousPropertyId.current === activePropertyId) return;
    const isPropertySwitch = Boolean(previousPropertyId.current);
    previousPropertyId.current = activePropertyId;
    if (!isPropertySwitch) return;
    hasInitializedPage.current = false;
    sessionStorage.removeItem("statsPageIndex");
  }, [activePropertyId]);

  useEffect(() => {
    if (!isInitialized || !sortedStats.length || propertyChanged) return;
    if (!hasInitializedPage.current) {
      const storedValue = sessionStorage.getItem("statsPageIndex");
      const storedIndex = storedValue === null ? NaN : Number(storedValue);
      const nextIndex = Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < pageCount ? storedIndex : 0;
      setPageIndex(nextIndex);
      sessionStorage.setItem("statsPageIndex", String(nextIndex));
      hasInitializedPage.current = true;
      return;
    }
    if (pageIndex >= pageCount) {
      const nextIndex = pageCount - 1;
      setPageIndex(nextIndex);
      sessionStorage.setItem("statsPageIndex", String(nextIndex));
    }
  }, [isInitialized, pageCount, pageIndex, propertyChanged, sortedStats]);

  function changePage(nextIndex) {
    const boundedIndex = Math.max(0, Math.min(pageCount - 1, nextIndex));
    setPageIndex(boundedIndex);
    sessionStorage.setItem("statsPageIndex", String(boundedIndex));
  }

  if (!isInitialized || isLoading) {
    return (
      <main className="px-5 pb-24 pt-6">
        <button onClick={onOpenProperties} className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-2xl px-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
          <span className="max-w-[240px] truncate">{activePropertyName}</span>
          <ChevronDown size={13} />
        </button>
        <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />
        <h1 className="text-2xl font-extrabold">Performance</h1>
        <Skeleton className="mt-6 h-[292px]" />
        <div className="mt-3 grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="mt-7 h-5 w-36 rounded-full" />
        <Skeleton className="mt-3 h-[220px]" />
      </main>
    );
  }

  if (!stats.length) {
    return (
      <main className="px-5 pb-24 pt-6">
        <button onClick={onOpenProperties} className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-2xl px-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
          <span className="max-w-[240px] truncate">{activePropertyName}</span>
          <ChevronDown size={13} />
        </button>
        <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />
        <h1 className="text-2xl font-extrabold">Performance</h1>
        {!isOnline ? <OfflineUnavailable onRetry={onRetry} /> : (
        <Card className="mt-6 p-8 text-center text-muted"><TrendingUp className="mx-auto text-accent" size={24} /><p className="mt-3 text-sm font-bold">No stats yet</p></Card>
        )}
      </main>
    );
  }

  return (
    <main className="px-5 pb-24 pt-6">
      <button onClick={onOpenProperties} className="-ml-2 mb-1 flex min-h-11 items-center gap-1 rounded-2xl px-2 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
        <span className="max-w-[240px] truncate">{activePropertyName}</span>
        <ChevronDown size={13} />
      </button>
      <ConnectionStatus isOnline={isOnline} isSyncing={isSyncing} />
      <h1 className="text-2xl font-extrabold">Performance</h1>
      <MonthNavigator
        className="my-6 rounded-2xl bg-panel p-2"
        label={monthRange(visibleStats)}
        previousDisabled={pageIndex >= pageCount - 1}
        nextDisabled={pageIndex === 0}
        previousLabel="Previous stats months"
        nextLabel="Next stats months"
        onPrevious={() => changePage(pageIndex + 1)}
        onNext={() => changePage(pageIndex - 1)}
      />
      <StatsChartCard stats={visibleStats} formatCurrency={formatCurrency} isDarkTheme={isDarkTheme} />
      <BestWorstCards stats={sortedStats} formatCurrency={formatCurrency} />
      <MonthlySummaryTable stats={visibleStats} formatCurrency={formatCurrency} />
    </main>
  );
}
