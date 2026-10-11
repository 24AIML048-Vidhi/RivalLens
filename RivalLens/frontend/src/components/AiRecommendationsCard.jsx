import { useState, useEffect, useCallback } from "react";
import { getAiRecommendations } from "../services/api";

const BADGE_CONFIG = {
  urgent: {
    badgeClass: "bg-negative/15 text-negative border-negative/30",
    pillClass: "border-negative/30 bg-negative/5",
    icon: "⚡",
    label: "Critical Fix",
  },
  growth: {
    badgeClass: "bg-positive/15 text-positive border-positive/30",
    pillClass: "border-positive/30 bg-positive/5",
    icon: "🚀",
    label: "Growth Lever",
  },
  rival: {
    badgeClass: "bg-brand/15 text-brand-hover border-brand/30",
    pillClass: "border-brand/30 bg-brand/5",
    icon: "⚔️",
    label: "Rival Counter-Play",
  },
  innovation: {
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pillClass: "border-amber-500/30 bg-amber-500/5",
    icon: "💎",
    label: "Quick Win",
  },
};

const EFFORT_COLORS = {
  Low: "text-positive bg-positive/10 border-positive/20",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  High: "text-brand bg-brand/10 border-brand/20",
};

export default function AiRecommendationsCard({ activeBrand }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);
  const [completedMap, setCompletedMap] = useState({});

  const fetchRecommendations = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAiRecommendations(activeBrand.id);
      setData(res);
    } catch (err) {
      console.error("Failed to load AI recommendations:", err);
      setError(err?.message || "Could not generate AI recommendations.");
    } finally {
      setLoading(false);
    }
  }, [activeBrand?.id]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  function handleCopyActionPlan(rec) {
    const stepsText = Array.isArray(rec.solutionSteps)
      ? rec.solutionSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : rec.action_plan || "";

    const textToCopy = `Strategy: ${rec.title}\nFocus Area: ${rec.area}\nImpact: ${rec.predictedLift || rec.predicted_lift}\n\nProblem:\n${rec.problem || rec.diagnosis}\n\nAction Steps:\n${stepsText}\n\nExpected Result:\n${rec.expectedResult || ""}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleCompleted(id) {
    setCompletedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  if (!activeBrand) return null;

  const recommendations = data?.recommendations || [];
  const filteredRecs = recommendations.filter((rec) => {
    if (selectedFilter === "all") return true;
    const type = rec.badgeType || (rec.badge?.includes("Urgent") ? "urgent" : rec.badge?.includes("Rival") ? "rival" : "growth");
    return type === selectedFilter;
  });

  return (
    <div className="rounded-2xl border border-brand/40 bg-gradient-to-b from-brand/10 via-surface to-surface p-6 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-base font-bold text-text-primary">
              AI Growth & Brand Improvement Playbook
            </h2>
            <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand">
              Actionable Intelligence
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Tailored AI diagnostic for <strong className="text-text-primary">{activeBrand.name}</strong> ({data?.category || activeBrand.category || "General"}) based on consumer mentions & competitive gaps.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRecommendations}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-brand/30 bg-ink px-3.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
        >
          <span>{loading ? "Analyzing..." : "🔄 Refresh Playbook"}</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 text-xs text-text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
          <span>Analyzing consumer chatter, diagnosing weak aspects, and generating strategic growth levers…</span>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-negative/30 bg-negative/10 p-4 text-xs text-negative">
          ⚠️ {error}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="mt-5 space-y-5">
          {/* Executive KPI Overview Bar */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/80 bg-ink/70 p-4 sm:grid-cols-4">
            <div className="flex flex-col border-b border-border/40 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Current Sentiment</span>
              <span className="mt-1 font-mono text-base font-bold text-text-primary">
                {data?.currentSentiment || activeBrand.sentimentScore || 50} <span className="text-xs text-text-muted font-normal">/ 100</span>
              </span>
            </div>

            <div className="flex flex-col border-b border-border/40 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Projected Post-Execution</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-base font-bold text-positive">
                  {data?.projectedSentiment || 68.3}
                </span>
                <span className="rounded bg-positive/15 px-1.5 py-0.5 text-[10px] font-bold text-positive">
                  {data?.projectedLift || "+18.5 pts"}
                </span>
              </div>
            </div>

            <div className="flex flex-col border-b border-border/40 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Weakest Diagnosed Aspect</span>
              <span className="mt-1 text-xs font-bold text-negative truncate">
                ⚠️ {data?.weakestAspect || "Customer Support"}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Target Execution Window</span>
              <span className="mt-1 text-xs font-bold text-brand-hover">
                ⏱️ {data?.timeframe || "14–30 Days"}
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-text-muted mr-1">Filter Strategies:</span>
            {[
              { id: "all", label: `All (${recommendations.length})` },
              { id: "urgent", label: "⚡ Critical Fixes" },
              { id: "growth", label: "🚀 Growth Levers" },
              { id: "rival", label: "⚔️ Rival Plays" },
              { id: "innovation", label: "💎 Quick Wins" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedFilter === tab.id
                    ? "bg-brand text-white shadow-sm"
                    : "bg-surface border border-border text-text-muted hover:text-text-primary hover:border-text-muted/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredRecs.map((rec) => {
              const badgeType = rec.badgeType || (rec.badge?.includes("Urgent") ? "urgent" : rec.badge?.includes("Rival") ? "rival" : "growth");
              const config = BADGE_CONFIG[badgeType] || BADGE_CONFIG.growth;
              const isCompleted = Boolean(completedMap[rec.id]);
              const steps = Array.isArray(rec.solutionSteps)
                ? rec.solutionSteps
                : rec.action_plan
                ? [rec.action_plan]
                : [];

              return (
                <div
                  key={rec.id}
                  className={`flex flex-col justify-between rounded-xl border p-5 shadow-sm transition-all ${
                    isCompleted
                      ? "border-positive/40 bg-surface/50 opacity-75"
                      : "border-border bg-surface hover:border-brand/40"
                  }`}
                >
                  <div>
                    {/* Top Meta Bar */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.badgeClass}`}
                      >
                        <span>{config.icon}</span>
                        <span>{rec.badge || config.label}</span>
                      </span>

                      <span className="rounded-md bg-positive/10 border border-positive/20 px-2 py-0.5 font-mono text-[11px] font-bold text-positive">
                        {rec.predictedLift || rec.predicted_lift || "+18% Lift"}
                      </span>
                    </div>

                    {/* Title & Focus Area */}
                    <h3 className={`text-sm font-bold text-text-primary leading-snug ${isCompleted ? "line-through text-text-muted" : ""}`}>
                      {rec.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-brand-hover">
                      Focus Area: {rec.area}
                    </p>

                    {/* Structured Section 1: The Diagnosed Problem */}
                    <div className="mt-3.5 rounded-lg border border-border/70 bg-ink/50 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-primary mb-1">
                        <span className="text-negative">🔍</span>
                        <span>Diagnosed Friction:</span>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {rec.problem || rec.diagnosis}
                      </p>
                    </div>

                    {/* Structured Section 2: Actionable Implementation Steps */}
                    <div className="mt-2.5 rounded-lg border border-brand/20 bg-brand/5 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand mb-1.5">
                        <span>💡</span>
                        <span>Actionable Solution Steps:</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-text-primary leading-relaxed">
                        {steps.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="font-mono text-[11px] font-bold text-brand mt-0.5">{idx + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Structured Section 3: Expected Outcome */}
                    {(rec.expectedResult || rec.impact) && (
                      <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-positive/20 bg-positive/5 px-3 py-2 text-xs text-positive">
                        <span className="font-bold">📈 Expected Outcome:</span>
                        <span className="text-text-primary font-medium">{rec.expectedResult || `Targeting ${rec.impact}`}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${EFFORT_COLORS[rec.effort] || EFFORT_COLORS.Medium}`}>
                        {rec.effort || "Medium"} Effort
                      </span>
                      <span className="text-text-muted">
                        ⏱️ {rec.timeframe || "2–3 Weeks"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyActionPlan(rec)}
                        className="rounded-lg border border-border bg-ink px-2.5 py-1 text-[11px] font-semibold text-text-muted hover:text-text-primary hover:border-brand/40 transition-colors"
                      >
                        {copiedId === rec.id ? "✓ Copied!" : "📋 Copy Plan"}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCompleted(rec.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          isCompleted
                            ? "bg-positive text-white"
                            : "border border-border bg-surface text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {isCompleted ? "✓ Done" : "Mark Done"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center py-8 text-xs text-text-muted">
          No recommendations available. Click Refresh Playbook to analyze your brand.
        </div>
      )}
    </div>
  );
}