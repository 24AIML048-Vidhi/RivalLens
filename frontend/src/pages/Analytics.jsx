import { useState, useEffect } from "react";
import { getAnalytics } from "../services/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const COLORS = {
  positive: "#34D399",
  neutral: "#FBBF24",
  negative: "#F87171",
  brand: "#6C5CE7",
};

export default function Analytics({ brands = [], activeBrandId }) {
  const [selectedBrandId, setSelectedBrandId] = useState(activeBrandId || "");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    getAnalytics({
      brandId: selectedBrandId || null,
      days: days || null,
    })
      .then((data) => {
        setAnalytics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Analytics fetch error:", err);
        setLoading(false);
      });
  }, [selectedBrandId, days]);

  const dist = analytics?.sentimentDistribution || { positive: 0, neutral: 0, negative: 0 };
  const pieData = [
    { name: "Positive", value: dist.positive, color: COLORS.positive },
    { name: "Neutral", value: dist.neutral, color: COLORS.neutral },
    { name: "Negative", value: dist.negative, color: COLORS.negative },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Analytics & Intelligence</h1>
          <p className="text-sm text-text-muted">
            Deep dive into sentiment distributions, mention volumes, source platforms, and topics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Brand Selector */}
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
          >
            <option value="">All Tracked Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Time range */}
          <select
            value={days ?? ""}
            onChange={(e) => setDays(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="">All Time</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-text-muted">
          Loading analytics intelligence…
        </div>
      ) : (
        <>
          {/* Top Summary Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-text-muted">Total Mentions Analyzed</p>
              <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
                {analytics?.totalMentions.toLocaleString() || 0}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-text-muted">Avg Sentiment Index</p>
              <p className="mt-2 font-mono text-2xl font-bold text-brand-hover">
                {analytics?.averageSentiment || 50} <span className="text-xs font-normal text-text-muted">/ 100</span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-text-muted">Positive Ratio</p>
              <p className="mt-2 font-mono text-2xl font-bold text-positive">
                {dist.positivePct || 0}%
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-text-muted">Negative Ratio</p>
              <p className="mt-2 font-mono text-2xl font-bold text-negative">
                {dist.negativePct || 0}%
              </p>
            </div>
          </div>

          {/* Charts Row: Sentiment Distribution Pie + Source Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sentiment Distribution */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Sentiment Polarity Distribution</h3>
              <p className="text-xs text-text-muted">Classification of positive, neutral, and negative chatter</p>

              {pieData.length > 0 ? (
                <div className="mt-4 flex flex-col items-center sm:flex-row justify-around gap-4">
                  <div className="h-44 w-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-positive" />
                      <span className="text-xs text-text-primary font-medium">Positive:</span>
                      <span className="font-mono text-xs text-text-muted">{dist.positive} ({dist.positivePct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-neutral" />
                      <span className="text-xs text-text-primary font-medium">Neutral:</span>
                      <span className="font-mono text-xs text-text-muted">{dist.neutral} ({dist.neutralPct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-negative" />
                      <span className="text-xs text-text-primary font-medium">Negative:</span>
                      <span className="font-mono text-xs text-text-muted">{dist.negative} ({dist.negativePct}%)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-xs text-text-muted">No mention distribution data</p>
              )}
            </div>

            {/* Source Platform Breakdown */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Mentions by Data Source</h3>
              <p className="text-xs text-text-muted">Share of volume captured across social and web platforms</p>

              {analytics?.sourceBreakdown?.length > 0 ? (
                <div className="mt-6 flex flex-col gap-4">
                  {analytics.sourceBreakdown.map((src) => (
                    <div key={src.source}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-text-primary">{src.source}</span>
                        <span className="font-mono text-text-muted">
                          {src.count} mentions ({src.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-ink overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full"
                          style={{ width: `${src.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-12 text-center text-xs text-text-muted">No data source breakdown</p>
              )}
            </div>
          </div>

          {/* Sentiment Trend Timeline */}
          {analytics?.trend?.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Historical Sentiment Trajectory</h3>
              <p className="text-xs text-text-muted">Chronological sentiment tracking over time</p>

              <div className="mt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={analytics.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#262B3A" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" stroke="#8B92A8" tick={{ fontSize: 11, fill: "#8B92A8" }} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#8B92A8" tick={{ fontSize: 11, fill: "#8B92A8" }} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#6C5CE7" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Aspects / Topics Table */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text-primary">Aspect & Feature Intelligence</h3>
            <p className="text-xs text-text-muted">Extracted product topics and corresponding customer sentiment</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                    <th className="py-2.5 px-3">Aspect Topic</th>
                    <th className="py-2.5 px-3">Mention Count</th>
                    <th className="py-2.5 px-3">Sentiment Score</th>
                    <th className="py-2.5 px-3">Polarity Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-medium">
                  {analytics?.aspects?.map((a) => (
                    <tr key={a.aspect} className="hover:bg-ink/30">
                      <td className="py-3 px-3 text-text-primary font-semibold">{a.aspect}</td>
                      <td className="py-3 px-3 font-mono text-text-muted">{a.mentionCount}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono font-bold ${
                            a.positive >= a.negative ? "text-positive" : "text-negative"
                          }`}
                        >
                          {a.positive}% pos
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex h-2 w-32 overflow-hidden rounded-full bg-ink">
                          <div className="bg-positive" style={{ width: `${a.positive}%` }} />
                          <div className="bg-neutral" style={{ width: `${a.neutral}%` }} />
                          <div className="bg-negative" style={{ width: `${a.negative}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}