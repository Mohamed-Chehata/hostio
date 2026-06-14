import { TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "./ui";
import { shortMonth } from "../utils/monthUtils";

export function monthRange(stats) {
  if (!stats.length) return "No data yet";
  const sorted = [...stats].sort((a, b) => a.month.localeCompare(b.month));
  const first = formatMonthYear(sorted[0].month);
  const last = formatMonthYear(sorted.at(-1).month);
  return first === last ? first : `${first} — ${last}`;
}

export function blankStats(month) {
  return { month, totalRevenue: 0, unpaidRevenue: 0, occupancyRate: 0, occupancyNights: 0, netRevenue: 0 };
}

export function StatsChartCard({ stats, formatCurrency, isDarkTheme = true }) {
  const yAxis = chartScale(stats.map((item) => Number(item.netRevenue || 0)));
  const muted = isDarkTheme ? "#9A9A9A" : "#6B6B6B";
  const zeroLine = isDarkTheme ? "rgba(255,255,255,0.28)" : "rgba(10,10,10,0.28)";
  const cursor = isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.04)";
  return (
    <Card className="mt-6 p-4">
      <div className="mb-5 flex items-end justify-between">
        <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Net revenue</p><p className="mt-1 text-lg font-extrabold">{monthRange(stats)}</p></div>
        <TrendingUp className="text-accent" size={20} />
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} margin={{ left: 2, right: 0 }}>
            <CartesianGrid vertical={false} stroke={isDarkTheme ? "#2A2A2A" : "#E5E5E5"} />
            <XAxis dataKey="month" tickFormatter={shortMonth} tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[yAxis.min, yAxis.max]} ticks={yAxis.ticks} tickFormatter={formatCurrency} tick={{ fill: muted, fontSize: 11 }} width={58} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: cursor }} content={({ active, payload }) => active && payload?.length ? <div className="rounded-xl bg-panel px-3 py-2 text-xs font-bold text-white shadow-lg">{formatCurrency(payload[0].value)}</div> : null} />
            {yAxis.min < 0 && yAxis.max > 0 && <ReferenceLine y={0} stroke={zeroLine} strokeWidth={1.5} />}
            <Bar dataKey="netRevenue" radius={[6, 6, 6, 6]} animationDuration={220}>
              {stats.map((item) => <Cell key={item.month} fill={item.netRevenue < 0 ? "#FB923C" : "#FFD358"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function BestWorstCards({ stats, formatCurrency }) {
  if (!stats.length) return null;
  const best = stats.reduce((winner, item) => item.netRevenue > winner.netRevenue ? item : winner);
  const worst = stats.reduce((loser, item) => item.netRevenue < loser.netRevenue ? item : loser);
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <Card className="p-4"><TrendingUp className="text-emerald-300" size={17} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Best month</p><p className="mt-1 text-sm font-extrabold">{shortMonth(best.month)} - {formatCurrency(best.netRevenue)}</p></Card>
      <Card className="p-4"><TrendingDown className="text-orange-300" size={17} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Worst month</p><p className="mt-1 text-sm font-extrabold">{shortMonth(worst.month)} - {formatCurrency(worst.netRevenue)}</p></Card>
    </div>
  );
}

export function MonthlySummaryTable({ stats, formatCurrency }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-lg font-extrabold">Monthly summary</h2>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted"><span>Month</span><span>Revenue</span><span>Occup.</span><span className="text-right">Net</span></div>
        {stats.map((item) => <div key={item.month} className="grid grid-cols-4 border-t border-white/5 px-4 py-3 text-xs font-semibold"><span>{shortMonth(item.month)}</span><span>{formatCurrency(item.totalRevenue)}</span><span>{item.occupancyRate}%</span><span className={`text-right font-bold ${item.netRevenue < 0 ? "text-orange-300" : "text-accent"}`}>{formatCurrency(item.netRevenue)}</span></div>)}
      </Card>
    </section>
  );
}

function formatMonthYear(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function niceStep(value) {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 4 ? 4 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function chartScale(values) {
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const step = niceStep((maxValue - minValue || maxValue || 1) / 5);
  const min = minValue < 0 ? Math.floor(minValue / step) * step : 0;
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = [];
  for (let value = min; value <= max + step / 2; value += step) ticks.push(Math.abs(value) < 0.0001 ? 0 : value);
  return { min, max, ticks };
}
