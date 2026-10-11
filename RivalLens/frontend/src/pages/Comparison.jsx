import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  compareBrands,
  getCompetitorSuggestions,
  addCompetitor,
  getCompetitiveInsights,
} from "../services/api";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export default function Comparison({
  brands = [],
  activeBrandId = null,
  activeBrand = null,
  onRefreshBrands,
}) {
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [competitiveInsights, setCompetitiveInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState(null);

  /*
   * Active brand isolation
   */
  const currentActiveBrand = useMemo(() => {
    if (activeBrand) return activeBrand;
    return brands.find((b) => b.id === activeBrandId) || brands[0] || null;
  }, [activeBrand, activeBrandId, brands]);

  /*
   * Saved competitors for active brand
   */
  const savedCompetitors = useMemo(() => {
    if (!currentActiveBrand) return [];

    const rawCompetitors =
      currentActiveBrand.competitorBrands && currentActiveBrand.competitorBrands.length > 0
        ? currentActiveBrand.competitorBrands
        : currentActiveBrand.competitors ||
          currentActiveBrand.competitor_brands ||
          [];

    if (!Array.isArray(rawCompetitors)) return [];

    return rawCompetitors
      .map((competitor, idx) => {
        if (typeof competitor === "object" && competitor !== null) {
          return {
            id: competitor.id,
            name: competitor.name,
            category: competitor.category || currentActiveBrand.category || "General",
          };
        }

        const matchedBrand = brands.find((b) => b.id === competitor);
        if (matchedBrand) {
          return {
            id: matchedBrand.id,
            name: matchedBrand.name,
            category: matchedBrand.category,
          };
        }

        const fallbackName = currentActiveBrand.competitorNames?.[idx] || competitor;
        return {
          id: competitor,
          name: fallbackName,
          category: currentActiveBrand.category || "General",
        };
      })
      .filter((c) => c && c.id && c.id !== currentActiveBrand.id);
  }, [currentActiveBrand, brands]);

  /*
   * Reset selected competitors when active brand changes
   */
  useEffect(() => {
    if (!currentActiveBrand) {
      setSelectedCompetitorIds([]);
      setComparisonData(null);
      setCompetitiveInsights(null);
      return;
    }

    const ids = savedCompetitors.map((c) => c.id);
    setSelectedCompetitorIds(ids);
  }, [currentActiveBrand?.id, savedCompetitors]);

  const comparisonBrandIds = useMemo(() => {
    if (!currentActiveBrand?.id) return [];
    return [
      currentActiveBrand.id,
      ...selectedCompetitorIds.filter((id) => id !== currentActiveBrand.id),
    ];
  }, [currentActiveBrand?.id, selectedCompetitorIds]);

  /*
   * Fetch Comparison Data
   */
  useEffect(() => {
    if (comparisonBrandIds.length === 0) {
      setComparisonData(null);
      setCompetitiveInsights(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [compRes, insightsRes] = await Promise.all([
          compareBrands(comparisonBrandIds),
          getCompetitiveInsights(currentActiveBrand.id, selectedCompetitorIds).catch(() => null),
        ]);

        if (!cancelled) {
          setComparisonData(compRes);
          setCompetitiveInsights(insightsRes);
        }
      } catch (err) {
        console.error("Comparison load error:", err);
        if (!cancelled) {
          setComparisonData(null);
          setCompetitiveInsights(null);
          setError(err?.message || "Failed to load comparison data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [comparisonBrandIds, currentActiveBrand?.id, selectedCompetitorIds]);

  function handleToggleCompetitor(brandId) {
    if (!brandId) return;
    setSelectedCompetitorIds((prev) => {
      if (prev.includes(brandId)) {
        return prev.filter((id) => id !== brandId);
      }
      return [...prev, brandId];
    });
  }

  async function handleAutoSuggest(count = 2) {
    if (!currentActiveBrand) return;

    setSuggesting(true);
    setError(null);

    try {
      const data = await getCompetitorSuggestions(
        currentActiveBrand.name,
        currentActiveBrand.category || "",
        count
      );

      const suggestions = Array.isArray(data)
        ? data
        : data?.suggestions || data?.competitors || [];

      const addedIds = [];
      for (const comp of suggestions) {
        if (comp.id && comp.id !== currentActiveBrand.id) {
          try {
            await addCompetitor(currentActiveBrand.id, comp.id);
            addedIds.push(comp.id);
          } catch (err) {
            console.warn("Auto-link competitor warning:", err);
          }
        }
      }

      if (addedIds.length > 0) {
        setSelectedCompetitorIds((prev) => Array.from(new Set([...prev, ...addedIds])));
      }

      if (onRefreshBrands) {
        await onRefreshBrands();
      }
    } catch (err) {
      console.error("Auto suggest error:", err);
      setError(err?.message || "Failed to find competitors.");
    } finally {
      setSuggesting(false);
    }
  }

  // Chart data
  const chartData = useMemo(() => {
    return (
      comparisonData?.brands?.map((brand) => ({
        name: brand.name,
        sentimentScore: Number(brand.sentimentScore) || 0,
        mentions: Number(brand.mentionCount) || 0,
        positivePct: Number(brand.positivePct) || 0,
        neutralPct: Number(brand.neutralPct) || 0,
        negativePct: Number(brand.negativePct) || 0,
      })) || []
    );
  }, [comparisonData]);

  // Score comparison calculation
  const scoreStats = useMemo(() => {
    if (!comparisonData?.brands || comparisonData.brands.length < 2) return null;
    const activeItem = comparisonData.brands.find((b) => b.id === currentActiveBrand?.id);
    const competitorItems = comparisonData.brands.filter((b) => b.id !== currentActiveBrand?.id);

    if (!activeItem || competitorItems.length === 0) return null;

    const compAvgScore =
      competitorItems.reduce((acc, curr) => acc + (curr.sentimentScore || 0), 0) /
      competitorItems.length;

    const delta = Math.round((activeItem.sentimentScore - compAvgScore) * 10) / 10;
    return {
      activeScore: activeItem.sentimentScore,
      competitorAvg: Math.round(compAvgScore * 10) / 10,
      delta,
      isHigher: delta >= 0,
    };
  }, [comparisonData, currentActiveBrand?.id]);

  if (!currentActiveBrand) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Competitor Comparison</h1>
          <p className="mt-1 text-sm text-text-muted">
            Select a brand to compare it against its competitors.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center">
          <span className="text-4xl">⚔️</span>
          <p className="mt-3 font-semibold text-text-primary">No brand selected</p>
          <p className="mt-1 text-xs text-text-muted">
            Please add or choose a brand to start comparing.
          </p>
          <Link
            to="/add-brand"
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-hover"
          >
            + Add Brand
          </Link>
        </div>
      </div>
    );
  }

  const sentimentLeader = comparisonData?.sentimentLeader || currentActiveBrand.name;
  const isLeader = sentimentLeader === currentActiveBrand.name;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Competitor Benchmark & Comparison</h1>
            <span className="rounded-full bg-brand/10 border border-brand/30 px-3 py-0.5 text-xs font-semibold text-brand-hover">
              AI Powered
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Comparing <strong className="text-text-primary">{currentActiveBrand.name}</strong> against direct competitors.
          </p>
        </div>

        <Link
          to="/add-brand"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors"
        >
          + Add New Competitor
        </Link>
      </div>

      {/* Competitor Selection Toolbar */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase text-brand">Active Brand:</span>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-bold text-text-primary">{currentActiveBrand.name}</span>
              {currentActiveBrand.category && (
                <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 text-xs text-brand-hover">
                  {currentActiveBrand.category}
                </span>
              )}
            </div>
          </div>

          {/* Quick Auto-Suggest Button */}
          <button
            type="button"
            onClick={() => handleAutoSuggest(2)}
            disabled={suggesting}
            className="rounded-lg border border-brand/40 bg-ink px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
          >
            {suggesting ? "Finding..." : "✨ Auto-Find 2 Competitors"}
          </button>
        </div>

        {/* Competitor Chips */}
        <div className="mt-4 pt-3 border-t border-border/50">
          <p className="text-xs font-medium text-text-muted mb-2">
            Select competitors to include in benchmark comparison:
          </p>

          {savedCompetitors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {savedCompetitors.map((comp) => {
                const isSelected = selectedCompetitorIds.includes(comp.id);
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => handleToggleCompetitor(comp.id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-brand bg-brand text-white shadow-sm"
                        : "border-border bg-ink text-text-muted hover:text-text-primary"
                    }`}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>{comp.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">
              No competitors saved yet. Click "Auto-Find 2 Competitors" to automatically discover rivals.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-negative/30 bg-negative/10 p-3 text-xs text-negative">
          ⚠️ {error}
        </div>
      )}

      {/* Comparison Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface text-xs text-text-muted">
          Loading comparison data...
        </div>
      ) : comparisonData?.brands?.length > 0 ? (
        <>
          {/* AI COMPETITIVE ANALYSIS & VERDICT CARD */}
          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-surface to-surface p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h2 className="text-sm font-bold text-text-primary">AI Competitive Insights & Verdict</h2>
                <span className="rounded bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                  Smart Comparison
                </span>
              </div>
              <span className="text-xs text-text-muted font-mono">
                {comparisonData.brands.length} Brands Benchmarked
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Verdict 1: Overall Winner */}
              <div className="rounded-lg border border-border/70 bg-ink/60 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-positive mb-1">
                    <span>🏆</span>
                    <span>Sentiment Winner:</span>
                  </div>
                  <p className="text-sm font-bold text-text-primary">
                    {sentimentLeader}
                  </p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {isLeader
                      ? `${currentActiveBrand.name} holds the highest positive customer satisfaction among compared brands.`
                      : `${sentimentLeader} leads the sentiment ranking. ${currentActiveBrand.name} trails by ${Math.abs(scoreStats?.delta || 0)} points.`}
                  </p>
                </div>
              </div>

              {/* Verdict 2: Key Feature Battleground */}
              <div className="rounded-lg border border-border/70 bg-ink/60 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-hover mb-1">
                    <span>⚔️</span>
                    <span>Key Feature Battleground:</span>
                  </div>
                  <p className="text-sm font-bold text-text-primary">
                    {competitiveInsights?.strengths?.[0]?.aspect || "Product Quality"}
                  </p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {competitiveInsights?.strengths?.[0]
                      ? `${currentActiveBrand.name} has a strong ${competitiveInsights.strengths[0].advantage_pct} advantage in ${competitiveInsights.strengths[0].aspect}.`
                      : "User satisfaction is closely contested across common features."}
                  </p>
                </div>
              </div>

              {/* Verdict 3: Market Opportunity */}
              <div className="rounded-lg border border-border/70 bg-ink/60 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                    <span>🎯</span>
                    <span>AI Strategic Opportunity:</span>
                  </div>
                  <p className="text-sm font-bold text-text-primary">
                    {competitiveInsights?.opportunities?.[0]?.aspect
                      ? `Target ${competitiveInsights.opportunities[0].aspect}`
                      : "Differentiate on Customer Support"}
                  </p>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {competitiveInsights?.opportunities?.[0]?.opportunity ||
                      `Highlight superior service in areas where competitors receive customer complaints.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-positive/30 bg-positive/5 p-4 shadow-card">
              <span className="text-xs font-semibold uppercase text-positive">🏆 Highest Rated Brand</span>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {comparisonData.sentimentLeader || "N/A"}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">Top customer satisfaction score.</p>
            </div>

            <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 shadow-card">
              <span className="text-xs font-semibold uppercase text-brand-hover">📢 Most Reviewed Brand</span>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {comparisonData.volumeLeader || "N/A"}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">Highest volume of consumer chatter.</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <span className="text-xs font-semibold uppercase text-text-muted">⚖️ Head-to-Head Score Gap</span>
              {scoreStats ? (
                <>
                  <p className="mt-1 text-xl font-bold text-text-primary">
                    <span className={scoreStats.isHigher ? "text-positive" : "text-negative"}>
                      {scoreStats.delta > 0 ? `+${scoreStats.delta}` : scoreStats.delta} pts
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {scoreStats.isHigher
                      ? `${currentActiveBrand.name} is outperforming rival average.`
                      : `${currentActiveBrand.name} is trailing rival average.`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-text-muted">Add more brands to see difference.</p>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Chart 1: Sentiment Score vs Reviews Bar Chart */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">
                Sentiment Score vs Total Reviews
              </h3>
              <p className="text-xs text-text-muted">Comparing scores (0-100) and review counts</p>

              <div className="mt-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#262B3A" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#8B92A8" tick={{ fontSize: 12, fill: "#8B92A8" }} tickLine={false} />
                    <YAxis stroke="#8B92A8" tick={{ fontSize: 11, fill: "#8B92A8" }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#161B26",
                        borderColor: "#262B3A",
                        borderRadius: "0.5rem",
                        color: "#FFFFFF",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar dataKey="sentimentScore" name="Sentiment Score" fill="#34D399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="mentions" name="Reviews Count" fill="#6C5CE7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Positive vs Neutral vs Negative Stacked */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <h3 className="text-sm font-semibold text-text-primary">
                Positive vs Neutral vs Negative %
              </h3>
              <p className="text-xs text-text-muted">Customer feedback distribution for each brand</p>

              <div className="mt-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#262B3A" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#8B92A8" tick={{ fontSize: 12, fill: "#8B92A8" }} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#8B92A8" tick={{ fontSize: 11, fill: "#8B92A8" }} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#161B26",
                        borderColor: "#262B3A",
                        borderRadius: "0.5rem",
                        color: "#FFFFFF",
                        fontSize: "12px",
                      }}
                      formatter={(val) => `${val}%`}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar dataKey="positivePct" name="Positive %" stackId="s" fill="#34D399" />
                    <Bar dataKey="neutralPct" name="Neutral %" stackId="s" fill="#FBBF24" />
                    <Bar dataKey="negativePct" name="Negative %" stackId="s" fill="#F87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Feature / Aspect Comparison Cards */}
          {competitiveInsights?.aspect_benchmarks?.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
              <div className="border-b border-border/50 pb-3">
                <h3 className="text-sm font-semibold text-text-primary">Feature & Aspect Head-to-Head Comparison</h3>
                <p className="text-xs text-text-muted">
                  How {currentActiveBrand.name} rates compared to rivals on key touchpoints
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {competitiveInsights.aspect_benchmarks.map((ab) => (
                  <div
                    key={ab.aspect}
                    className="rounded-lg border border-border/60 bg-surface-card p-3.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-text-primary">🏷️ {ab.aspect}</span>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                          ab.diff >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                        }`}
                      >
                        {ab.diff > 0 ? `+${ab.diff}% Advantage` : `${ab.diff}% Gap`}
                      </span>
                    </div>

                    <div className="mt-2 text-xs flex justify-between text-text-muted pt-1 border-t border-border/30">
                      <span>{currentActiveBrand.name}: <strong className="text-text-primary">{ab.target_score} pts</strong></span>
                      <span>Competitors Avg: <strong className="text-text-primary">{ab.competitor_avg_score} pts</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side Comparison Table */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text-primary">Comparison Summary Table</h3>
            <p className="text-xs text-text-muted">Side-by-side metrics across all benchmarked brands</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border uppercase tracking-wider text-text-muted">
                    <th className="px-3 py-2.5">Brand</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Total Reviews</th>
                    <th className="px-3 py-2.5">Sentiment Score</th>
                    <th className="px-3 py-2.5">Positive %</th>
                    <th className="px-3 py-2.5">Negative %</th>
                    <th className="px-3 py-2.5">Top Feature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {comparisonData.brands.map((brand) => {
                    const isActive = brand.id === currentActiveBrand.id;
                    return (
                      <tr key={brand.id} className={isActive ? "bg-brand/10 font-bold" : "hover:bg-ink/30"}>
                        <td className="px-3 py-3 text-text-primary">
                          <div className="flex items-center gap-1.5">
                            <span>{brand.name}</span>
                            {isActive && (
                              <span className="rounded bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-text-muted">{brand.category || "General"}</td>
                        <td className="px-3 py-3 font-mono text-text-primary">{brand.mentionCount}</td>
                        <td className="px-3 py-3 font-mono font-bold text-brand-hover">{brand.sentimentScore} / 100</td>
                        <td className="px-3 py-3 font-mono text-positive">{brand.positivePct}%</td>
                        <td className="px-3 py-3 font-mono text-negative">{brand.negativePct}%</td>
                        <td className="px-3 py-3 text-text-muted">{brand.topAspect || "General"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <span className="text-3xl">⚔️</span>
          <p className="mt-2 text-sm font-semibold text-text-primary">No competitors selected</p>
          <p className="mt-1 text-xs text-text-muted">
            Click on one or more competitors above or click "Auto-Find 2 Competitors" to compare.
          </p>
        </div>
      )}
    </div>
  );
}