import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  compareBrands,
  getCompetitorSuggestions,
  addCompetitor,
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
import AiRecommendationsCard from "../components/AiRecommendationsCard";

export default function Comparison({
  brands = [],
  activeBrandId = null,
  activeBrand = null,
  onRefreshBrands,
}) {
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(2);
  const [error, setError] = useState(null);

  /*
   * ============================================================
   * STRICT ACTIVE BRAND ISOLATION
   * ============================================================
   */
  const currentActiveBrand = useMemo(() => {
    if (activeBrand) return activeBrand;
    return brands.find((b) => b.id === activeBrandId) || brands[0] || null;
  }, [activeBrand, activeBrandId, brands]);

  /*
   * Extract ONLY the competitors associated with the active brand.
   */
  const savedCompetitors = useMemo(() => {
    if (!currentActiveBrand) return [];

    const rawCompetitors =
      (currentActiveBrand.competitorBrands && currentActiveBrand.competitorBrands.length > 0)
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
   * Reset selected competitors strictly whenever active brand changes.
   * Eliminates any previous search brand residual state.
   */
  useEffect(() => {
    if (!currentActiveBrand) {
      setSelectedCompetitorIds([]);
      setComparisonData(null);
      return;
    }

    const ids = savedCompetitors.map((c) => c.id);
    setSelectedCompetitorIds(ids);
  }, [currentActiveBrand?.id, savedCompetitors]);

  /*
   * Active brand ID + selected competitor IDs ONLY.
   */
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
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadComparison() {
      setLoading(true);
      setError(null);

      try {
        const data = await compareBrands(comparisonBrandIds);
        if (!cancelled) {
          setComparisonData(data);
        }
      } catch (err) {
        console.error("Comparison load error:", err);
        if (!cancelled) {
          setComparisonData(null);
          setError(err?.message || "Failed to load comparison data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadComparison();

    return () => {
      cancelled = true;
    };
  }, [comparisonBrandIds]);

  /*
   * Toggle competitor selection for active brand
   */
  function handleToggleCompetitor(brandId) {
    if (!brandId) return;
    setSelectedCompetitorIds((prev) => {
      if (prev.includes(brandId)) {
        return prev.filter((id) => id !== brandId);
      }
      return [...prev, brandId];
    });
  }

  /*
   * Auto-Suggest 2 or 3 Competitors for the Active Brand
   */
  async function handleAutoSuggest(count = 2) {
    if (!currentActiveBrand) return;

    setSuggestionCount(count);
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

      // Link any suggested competitors that exist or are created
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
      setError(err?.message || "Failed to generate competitor suggestions.");
    } finally {
      setSuggesting(false);
    }
  }

  const chartData =
    comparisonData?.brands?.map((brand) => ({
      name: brand.name,
      sentimentScore: Number(brand.sentimentScore) || 0,
      mentions: Number(brand.mentionCount) || 0,
      positivePct: Number(brand.positivePct) || 0,
      negativePct: Number(brand.negativePct) || 0,
    })) || [];

  if (!currentActiveBrand) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Competitor Benchmark & Comparison
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Select an active brand to view its competitor comparison.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-12 text-center">
          <span className="text-4xl">⚔️</span>
          <p className="mt-3 font-semibold text-text-primary">No active brand selected</p>
          <p className="mt-1 text-xs text-text-muted">
            Please add a brand or select one from the top brand switcher.
          </p>
          <Link
            to="/add-brand"
            className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow hover:bg-brand-hover"
          >
            + Add New Brand
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Competitor Benchmark & Comparison
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Showing benchmark metrics strictly for active brand{" "}
            <span className="font-semibold text-text-primary">{currentActiveBrand.name}</span>{" "}
            and its direct competitors.
          </p>
        </div>

        <Link
          to="/add-brand"
          className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-primary hover:border-brand/40 hover:bg-surface-hover transition-colors"
        >
          + Add Brand / Competitor
        </Link>
      </div>

      {/* Active Brand Card & Competitor Filter Bar */}
      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand">
              Active Brand Under Analysis
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="text-xl font-bold text-text-primary">{currentActiveBrand.name}</h2>
              {currentActiveBrand.category && (
                <span className="rounded-lg bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {currentActiveBrand.category}
                </span>
              )}
            </div>
          </div>

          {/* Auto-Suggest Quick Actions */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Auto-Discover Rivals:</span>
            <button
              type="button"
              onClick={() => handleAutoSuggest(2)}
              disabled={suggesting}
              className="rounded-lg border border-brand/40 bg-surface px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
            >
              {suggesting && suggestionCount === 2 ? "Analyzing..." : "✨ Suggest 2"}
            </button>
            <button
              type="button"
              onClick={() => handleAutoSuggest(3)}
              disabled={suggesting}
              className="rounded-lg border border-brand/40 bg-surface px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
            >
              {suggesting && suggestionCount === 3 ? "Analyzing..." : "✨ Suggest 3"}
            </button>
          </div>
        </div>

        {/* Competitor Chips Toggle */}
        <div className="mt-4 pt-4 border-t border-brand/20">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Associated Competitors for {currentActiveBrand.name}:
            </p>
            <span className="text-[11px] text-text-muted">
              Comparing {comparisonBrandIds.length} brand{comparisonBrandIds.length !== 1 ? "s" : ""}
            </span>
          </div>

          {savedCompetitors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {savedCompetitors.map((comp) => {
                const isSelected = selectedCompetitorIds.includes(comp.id);
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => handleToggleCompetitor(comp.id)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? "border-brand bg-brand text-white shadow-sm"
                        : "border-border bg-ink/70 text-text-muted hover:border-brand/40 hover:text-text-primary"
                    }`}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>{comp.name}</span>
                    {comp.category && (
                      <span className={`text-[10px] opacity-80 ${isSelected ? "text-white/80" : ""}`}>
                        ({comp.category})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-ink/50 p-4 flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-text-muted">
                No direct competitors configured for <strong>{currentActiveBrand.name}</strong> yet.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoSuggest(2)}
                  className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  Auto-Discover 2 Rivals
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-negative/30 bg-negative/10 p-4 text-xs font-medium text-negative">
          ⚠️ {error}
        </div>
      )}

      {/* Comparison Analytics View */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-surface text-sm text-text-muted">
          Analyzing brand benchmark data…
        </div>
      ) : comparisonData?.brands?.length > 0 ? (
        <>
          {/* Leaders Banner */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-positive/30 bg-positive/5 p-5 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-positive">
                <span>🏆</span>
                <span>Sentiment Leader</span>
              </div>
              <p className="mt-2 text-xl font-bold text-text-primary">
                {comparisonData.sentimentLeader || "N/A"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Highest proportion of positive sentiment across Instagram, YouTube, and reviews.
              </p>
            </div>

            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 shadow-card">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-hover">
                <span>📢</span>
                <span>Volume & Share of Voice Leader</span>
              </div>
              <p className="mt-2 text-xl font-bold text-text-primary">
                {comparisonData.volumeLeader || "N/A"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Generates the highest total online chatter and feedback volume.
              </p>
            </div>
          </div>

          {/* Benchmark Bar Chart */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text-primary">
              Sentiment Score vs Mention Volume
            </h3>
            <p className="text-xs text-text-muted">
              {currentActiveBrand.name} vs Direct Competitors
            </p>

            <div className="mt-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="#262B3A" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#8B92A8"
                    tick={{ fontSize: 12, fill: "#8B92A8" }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#8B92A8"
                    tick={{ fontSize: 11, fill: "#8B92A8" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161B26",
                      borderColor: "#262B3A",
                      borderRadius: "0.75rem",
                      color: "#FFFFFF",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="sentimentScore"
                    name="Sentiment Score (0-100)"
                    fill="#34D399"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="mentions"
                    name="Total Mentions"
                    fill="#6C5CE7"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Head-to-Head Comparison Table */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-semibold text-text-primary">
              Head-to-Head Metrics Table
            </h3>
            <p className="text-xs text-text-muted">
              Benchmark comparison between {currentActiveBrand.name} and competitors
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border uppercase tracking-wider text-text-muted">
                    <th className="px-3 py-3">Brand</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Total Mentions</th>
                    <th className="px-3 py-3">Sentiment Score</th>
                    <th className="px-3 py-3">Positive %</th>
                    <th className="px-3 py-3">Negative %</th>
                    <th className="px-3 py-3">Trend</th>
                    <th className="px-3 py-3">Top Aspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-medium">
                  {comparisonData.brands.map((brand) => {
                    const isActive = brand.id === currentActiveBrand.id;
                    return (
                      <tr
                        key={brand.id}
                        className={`hover:bg-ink/40 transition-colors ${
                          isActive ? "bg-brand/10 font-bold" : ""
                        }`}
                      >
                        <td className="px-3 py-3.5 text-text-primary">
                          <div className="flex items-center gap-2">
                            <span>{brand.name}</span>
                            {isActive && (
                              <span className="rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                                Active Brand
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-text-muted">
                          {brand.category || "General"}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-text-primary">
                          {brand.mentionCount}
                        </td>
                        <td className="px-3 py-3.5 font-mono font-bold text-brand-hover">
                          {brand.sentimentScore} / 100
                        </td>
                        <td className="px-3 py-3.5 font-mono text-positive">
                          {brand.positivePct}%
                        </td>
                        <td className="px-3 py-3.5 font-mono text-negative">
                          {brand.negativePct}%
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              brand.trend === "up"
                                ? "bg-positive/10 text-positive"
                                : brand.trend === "down"
                                ? "bg-negative/10 text-negative"
                                : "bg-surface-hover text-text-muted"
                            }`}
                          >
                            {brand.trend || "stable"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-text-muted">
                          {brand.topAspect || "General"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* AI Competitive Advantage & Strategic Innovation */}
          <AiRecommendationsCard activeBrand={currentActiveBrand} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <span className="text-3xl">⚔️</span>
          <p className="mt-2 font-semibold text-text-primary">No competitors selected</p>
          <p className="mt-1 max-w-md text-xs text-text-muted">
            Click on one or more competitors above or click <strong>Suggest 2 / 3</strong> to benchmark {currentActiveBrand.name}.
          </p>
        </div>
      )}
    </div>
  );
}