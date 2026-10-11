import { useState, useEffect } from "react";
import { getAnalytics, getSentimentForecast } from "../services/api";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import SentimentForecastChart from "../components/SentimentForecastChart";

const COLORS = {
  positive: "#34D399",
  neutral: "#FBBF24",
  negative: "#F87171",
  brand: "#6C5CE7",
};

export default function Analytics({ brands = [], activeBrandId }) {
  const [selectedBrandId, setSelectedBrandId] = useState(activeBrandId || "");
  const [analytics, setAnalytics] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (activeBrandId && !selectedBrandId) {
      setSelectedBrandId(activeBrandId);
    }
  }, [activeBrandId, selectedBrandId]);

  const targetBrandId = selectedBrandId || activeBrandId || (brands[0]?.id ?? null);
  const targetBrand = brands.find((b) => b.id === targetBrandId) || null;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAnalytics({
        brandId: selectedBrandId || null,
        days: days || null,
      }).catch(() => null),
      targetBrandId ? getSentimentForecast(targetBrandId, 7).catch(() => null) : Promise.resolve(null),
    ])
      .then(([analyticsData, forecastRes]) => {
        setAnalytics(analyticsData);
        setForecastData(forecastRes);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Analytics fetch error:", err);
        setLoading(false);
      });
  }, [selectedBrandId, targetBrandId, days]);

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Analytics & AI Forecasting</h1>
            <span className="rounded-full bg-brand/10 border border-brand/30 px-3 py-0.5 text-xs font-semibold text-brand-hover">
              Predictive NLP
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Sentiment breakdowns, platform distributions, and 7-day predictive trend forecasting.
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
            <option value="">All Time</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-text-muted">
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-xs uppercase text-text-muted font-medium">Total Reviews</p>
              <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
                {analytics?.totalMentions.toLocaleString() || 0}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">Analyzed mentions</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-xs uppercase text-text-muted font-medium">Avg Sentiment Score</p>
              <p className="mt-2 font-mono text-2xl font-bold text-brand-hover">
                {analytics?.averageSentiment || 50} <span className="text-xs font-normal text-text-muted">/ 100</span>
              </p>
              <p className="mt-1 text-[11px] text-text-muted">Score out of 100</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-xs uppercase text-text-muted font-medium">Positive Ratio</p>
              <p className="mt-2 font-mono text-2xl font-bold text-positive">
                {dist.positivePct || 0}%
              </p>
              <p className="mt-1 text-[11px] text-text-muted">{dist.positive} positive reviews</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <p className="text-xs uppercase text-text-muted font-medium">Negative Ratio</p>
              <p className="mt-2 font-mono text-2xl font-bold text-negative">
                {dist.negativePct || 0}%
              </p>
              <p className="mt-1 text-[11px] text-text-muted">{dist.negative} negative reviews</p>
            </div>
          </div>

          {/* AI 7-DAY SENTIMENT FORECAST (Integrated cleanly) */}
          {forecastData && (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
                <span>
                  Predictive trajectory for: <strong className="text-text-primary">{targetBrand?.name || "Selected Brand"}</strong>
                </span>
                <span className="text-[11px] text-brand-hover">AI Trend Model</span>
              </div>
              <SentimentForecastChart data={forecastData} />
            </div>
          )}

          {/* Charts Row: Sentiment Pie + Platform Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Sentiment Breakdown Pie */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Sentiment Breakdown</h3>
              <p className="text-xs text-text-muted">Positive vs Neutral vs Negative feedback</p>

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
                          innerRadius={40}
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

                  <div className="flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-positive" />
                      <span className="font-medium text-text-primary">Positive:</span>
                      <span className="font-mono text-text-muted">{dist.positive} ({dist.positivePct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-neutral" />
                      <span className="font-medium text-text-primary">Neutral:</span>
                      <span className="font-mono text-text-muted">{dist.neutral} ({dist.neutralPct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-negative" />
                      <span className="font-medium text-text-primary">Negative:</span>
                      <span className="font-mono text-text-muted">{dist.negative} ({dist.negativePct}%)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-xs text-text-muted">No mention distribution data</p>
              )}
            </div>

            {/* Platform / Source Breakdown */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Reviews by Platform Source</h3>
              <p className="text-xs text-text-muted">Sources where user feedback was gathered</p>

              {analytics?.sourceBreakdown?.length > 0 ? (
                <div className="mt-6 flex flex-col gap-4">
                  {analytics.sourceBreakdown.map((src) => (
                    <div key={src.source}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-text-primary">{src.source}</span>
                        <span className="font-mono text-text-muted">
                          {src.count} reviews ({src.percentage}%)
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
                <p className="py-12 text-center text-xs text-text-muted">No data sources available</p>
              )}
            </div>
          </div>

          {/* Sentiment Trend Timeline */}
          {analytics?.trend?.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Historical Sentiment Trajectory</h3>
              <p className="text-xs text-text-muted">Daily average sentiment score progression</p>

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
          {analytics?.aspects?.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">Topic & Feature Sentiment</h3>
              <p className="text-xs text-text-muted">Specific aspects mentioned in user reviews</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                      <th className="py-2.5 px-3">Feature Aspect</th>
                      <th className="py-2.5 px-3">Review Count</th>
                      <th className="py-2.5 px-3">Sentiment Score</th>
                      <th className="py-2.5 px-3">Positive vs Negative</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-medium">
                    {analytics.aspects.map((a) => (
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
          )}
        </>
      )}
    </div>
  );
}