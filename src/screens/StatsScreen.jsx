import { TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/ui";
import { shortMonth } from "../lib/utils";

export function StatsScreen({ stats, activePropertyName = "My Property", formatCurrency }) {
  const best = stats.reduce((winner, item) => item.netRevenue > winner.netRevenue ? item : winner);
  const worst = stats.reduce((loser, item) => item.netRevenue < loser.netRevenue ? item : loser);

  return (
    <main className="px-5 pb-24 pt-6">
      <p className="mb-1 max-w-[240px] truncate text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{activePropertyName}</p>
      <h1 className="text-2xl font-extrabold">Performance</h1>
      <Card className="mt-6 p-4">
        <div className="mb-5 flex items-end justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-muted">Net revenue</p><p className="mt-1 text-lg font-extrabold">Jan — Jul 2025</p></div>
          <TrendingUp className="text-accent" size={20} />
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} margin={{ left: -24, right: 0 }}>
              <XAxis dataKey="month" tickFormatter={shortMonth} tick={{ fill: "#9A9A9A", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9A9A9A", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => active && payload?.length ? <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-ink">{formatCurrency(payload[0].value)}</div> : null} />
              <Bar dataKey="netRevenue" radius={[6, 6, 6, 6]}>{stats.map((item) => <Cell key={item.month} fill={item.netRevenue < 0 ? "#FB923C" : "#FFD358"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4"><TrendingUp className="text-emerald-300" size={17} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Best month</p><p className="mt-1 text-sm font-extrabold">{shortMonth(best.month)} · {formatCurrency(best.netRevenue)}</p></Card>
        <Card className="p-4"><TrendingDown className="text-orange-300" size={17} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Worst month</p><p className="mt-1 text-sm font-extrabold">{shortMonth(worst.month)} · {formatCurrency(worst.netRevenue)}</p></Card>
      </div>

      <section className="mt-7">
        <h2 className="mb-3 text-lg font-extrabold">Monthly summary</h2>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted"><span>Month</span><span>Revenue</span><span>Occup.</span><span className="text-right">Net</span></div>
          {stats.map((item) => <div key={item.month} className="grid grid-cols-4 border-t border-white/5 px-4 py-3 text-xs font-semibold"><span>{shortMonth(item.month)}</span><span>{formatCurrency(item.totalRevenue)}</span><span>{item.occupancyRate}%</span><span className={`text-right font-bold ${item.netRevenue < 0 ? "text-orange-300" : "text-accent"}`}>{formatCurrency(item.netRevenue)}</span></div>)}
        </Card>
      </section>
    </main>
  );
}
