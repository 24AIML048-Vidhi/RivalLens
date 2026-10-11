import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getBrandSummary,
  getBrandAspects,
  getBrandMentions,
  getAiRecommendations,
  triggerIngestion,
} from "../services/api";
import SentimentGauge from "../components/SentimentGauge";
import StatCard from "../components/StatCard";
import AspectBreakdown from "../components/AspectBreakdown";
import MentionCard from "../components/MentionCard";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 45000;

export default function Dashboard({ activeBrand, onRefreshBrands, onOpenAddMention }) {
  const [summary, setSummary] = useState(null);
  const [aspects, setAspects] = useState([]);
  const [recentMentions, setRecentMentions] = useState([]);
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ingestion status: "idle" | "running" | "done" | "timeout" | "error"
  const [ingestStatus, setIngestStatus] = useState("idle");
  const pollTimerRef = useRef(null);
  const pollDeadlineRef = useRef(null);
  const baselineCountRef = useRef(null);

  // Load Brand Data for activeBrand
  const loadData = useCallback(async () => {
    if (!activeBrand) return;
    setLoading(true);
    try {
      const [summaryData, aspectData, mentionData, aiRes] = await Promise.all([
        getBrandSummary(activeBrand.id).catch(() => null),
        getBrandAspects(activeBrand.id).catch(() => []),
        getBrandMentions(activeBrand.id, { limit: 5 }).catch(() => []),
        getAiRecommendations(activeBrand.id).catch(() => null),
      ]);

      setSummary(summaryData);
      setAspects(aspectData || []);
      setRecentMentions(mentionData || []);
      setAiData(aiRes);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeBrand]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Ingestion Run
  async function handleRunIngestion() {
    if (!activeBrand || ingestStatus === "running") return;

    setIngestStatus("running");
    baselineCountRef.current = activeBrand.mentionCount || 0;
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    try {
      await triggerIngestion(activeBrand.id);
      schedulePoll();
    } catch (err) {
      setIngestStatus("error");
    }
  }

  function schedulePoll() {
    pollTimerRef.current = setTimeout(async () => {
      try {
        const freshBrands = await onRefreshBrands();
        const fresh = freshBrands.find((b) => b.id === activeBrand.id);

        if (fresh && fresh.mentionCount > baselineCountRef.current) {
          setIngestStatus("done");
          loadData();
          return;
        }

        if (Date.now() >= pollDeadlineRef.current) {
          setIngestStatus("timeout");
          loadData();
          return;
        }

        schedulePoll();
      } catch (err) {
        setIngestStatus("error");
      }
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  if (!activeBrand) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-4xl">🏷️</span>
        <h2 className="text-lg font-bold text-text-primary">No Brand Selected</h2>
        <p className="max-w-sm text-sm text-text-muted">
          Please add a brand or select an existing one to view sentiment analysis.
        </p>
        <Link
          to="/add-brand"
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
        >
          + Add New Brand
        </Link>
      </div>
    );
  }

  const sentimentScore = summary?.sentimentScore ?? activeBrand.sentimentScore ?? 50;
  const mentionCount = summary?.mentionCount ?? activeBrand.mentionCount ?? 0;
  const positivePct = summary?.positivePct ?? 0;
  const negativePct = summary?.negativePct ?? 0;
  const neutralPct = summary?.neutralPct ?? 0;

  // Best and worst rated aspects
  const bestAspect = aspects.length > 0
    ? [...aspects].sort((a, b) => b.positive - a.positive)[0]
    : null;
  const worstAspect = aspects.length > 0
    ? [...aspects].sort((a, b) => b.negative - a.negative)[0]
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Brand Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 shadow-card">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{activeBrand.name}</h1>
            <span className="rounded-full bg-brand/10 border border-brand/30 px-3 py-0.5 text-xs font-medium text-brand-hover">
              {activeBrand.category || "General"}
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              AI Sentiment: {sentimentScore}/100
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Continuous NLP sentiment monitoring across social media, reviews, and customer chatter.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddMention}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
            >
              ✍️ Add Review
            </button>
            <button
              onClick={handleRunIngestion}
              disabled={ingestStatus === "running"}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {ingestStatus === "running" ? "🔄 Fetching..." : "⚡ Fetch Mentions"}
            </button>
          </div>
          <IngestStatusBadge status={ingestStatus} />
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Reviews"
          value={mentionCount.toLocaleString()}
          subtitle="Analyzed by NLP engine"
          icon="💬"
        />
        <StatCard
          label="AI Sentiment Score"
          value={`${sentimentScore} / 100`}
          subtitle={
            sentimentScore >= 60
              ? "Positive customer reception"
              : sentimentScore <= 40
              ? "Negative feedback detected"
              : "Neutral sentiment average"
          }
          icon="⭐"
        />
        <StatCard
          label="Positive Feedback"
          value={`${positivePct}%`}
          subtitle={`${summary?.positiveMentions || 0} satisfied reviews`}
          icon="🟢"
        />
        <StatCard
          label="Negative Feedback"
          value={`${negativePct}%`}
          subtitle={`${summary?.negativeMentions || 0} critical reviews`}
          icon="🔴"
        />
      </div>

      {/* AI SMART SUMMARY & INSIGHTS CARD */}
      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-surface to-surface p-5 shadow-card">
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-sm font-bold text-text-primary">AI Sentiment Summary & Insights</h2>
            <span className="rounded bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
              NLP Generated
            </span>
          </div>
          <span className="text-[11px] text-text-muted">Analysis of {mentionCount} customer reviews</span>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main AI Summary Text */}
          <div className="lg:col-span-2">
            <p className="text-xs text-text-primary leading-relaxed font-body">
              {aiData?.summary || (
                <span>
                  Based on recent customer feedback, <strong>{activeBrand.name}</strong> currently holds an overall sentiment rating of <strong>{sentimentScore}/100</strong>. 
                  Customer conversation shows <strong>{positivePct}% positive</strong> sentiment and <strong>{negativePct}% negative</strong> criticism across online channels.
                </span>
              )}
            </p>

            {/* Quick Feature Highlights */}
            <div className="mt-3.5 flex flex-wrap gap-2 text-xs">
              {bestAspect && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">🏆 Key Strength:</span>
                  <span className="text-text-primary font-medium">{bestAspect.aspect} ({bestAspect.positive}% pos)</span>
                </div>
              )}
              {worstAspect && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-rose-400 font-bold">⚠️ Customer Pain Point:</span>
                  <span className="text-text-primary font-medium">{worstAspect.aspect} ({worstAspect.negative}% neg)</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Recommended Actions */}
          <div className="rounded-lg border border-border/70 bg-ink/50 p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                💡 Key Recommendations:
              </span>
              <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
                {aiData?.recommendations?.slice(0, 2).map((rec, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-brand font-bold mt-0.5">•</span>
                    <span className="text-text-primary font-medium">{rec.title}</span>
                  </li>
                )) || (
                  <>
                    <li className="flex items-start gap-1.5">
                      <span className="text-brand font-bold">•</span>
                      <span>Address top complaints in {worstAspect?.aspect || "customer service"}.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-brand font-bold">•</span>
                      <span>Highlight strengths in {bestAspect?.aspect || "product quality"} in marketing.</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
            <Link
              to="/comparison"
              className="mt-3 text-[11px] text-brand-hover hover:underline inline-flex items-center gap-1 font-semibold"
            >
              <span>See how rivals compare</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Charts Row: Sentiment Gauge & Aspect Ratings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sentiment Meter */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-5 shadow-card">
          <SentimentGauge score={sentimentScore} label="Sentiment Index" />
          
          <div className="mt-4 flex w-full justify-around border-t border-border/50 pt-3 text-center text-xs">
            <div>
              <p className="font-mono font-bold text-positive">{summary?.positiveMentions || 0}</p>
              <p className="text-[11px] text-text-muted">Positive ({positivePct}%)</p>
            </div>
            <div>
              <p className="font-mono font-bold text-neutral">{summary?.neutralMentions || 0}</p>
              <p className="text-[11px] text-text-muted">Neutral ({neutralPct}%)</p>
            </div>
            <div>
              <p className="font-mono font-bold text-negative">{summary?.negativeMentions || 0}</p>
              <p className="text-[11px] text-text-muted">Negative ({negativePct}%)</p>
            </div>
          </div>
        </div>

        {/* Feature Ratings (Aspects) */}
        <div className="lg:col-span-2">
          <AspectBreakdown aspects={aspects} />
        </div>
      </div>

      {/* Competitor Comparison Callout */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h3 className="text-sm font-bold text-text-primary">
              Benchmark {activeBrand.name} Against Competitors
            </h3>
            <p className="text-xs text-text-muted">
              Side-by-side comparison on sentiment score, feature aspects, and review volume.
            </p>
          </div>
        </div>
        <Link
          to="/comparison"
          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover transition-colors"
        >
          Open Competitor Comparison →
        </Link>
      </div>

      {/* Recent Reviews List */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Recent Customer Reviews</h3>
            <p className="text-xs text-text-muted">Latest feedback for {activeBrand.name}</p>
          </div>
          <Link
            to="/mentions"
            className="text-xs font-semibold text-brand-hover hover:underline"
          >
            View all in Reviews →
          </Link>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-text-muted">Loading reviews...</p>
        ) : recentMentions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {recentMentions.map((m) => (
              <MentionCard key={m.id} mention={m} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-text-muted">
            No reviews recorded yet. Click "Add Review" or "Fetch Mentions" to add some!
          </div>
        )}
      </div>
    </div>
  );
}

function IngestStatusBadge({ status }) {
  if (status === "running") {
    return (
      <span className="text-xs text-brand-hover animate-pulse">
        🔄 Fetching mentions in background...
      </span>
    );
  }
  if (status === "done") {
    return <span className="text-xs text-positive">✓ Data updated successfully!</span>;
  }
  if (status === "timeout") {
    return <span className="text-xs text-neutral">⏳ Running in background.</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-negative">✕ Failed to fetch data.</span>;
  }
  return null;
}