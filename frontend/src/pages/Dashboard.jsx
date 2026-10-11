import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getBrandSummary,
  getBrandTrend,
  getBrandAspects,
  getBrandMentions,
  triggerIngestion,
} from "../services/api";
import SentimentGauge from "../components/SentimentGauge";
import StatCard from "../components/StatCard";
import SentimentTrendChart from "../components/SentimentTrendChart";
import AspectBreakdown from "../components/AspectBreakdown";
import MentionCard from "../components/MentionCard";
import AiRecommendationsCard from "../components/AiRecommendationsCard";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 45000;

export default function Dashboard({ activeBrand, onRefreshBrands, onOpenAddMention }) {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [trendDays, setTrendDays] = useState(14);
  const [aspects, setAspects] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [mentionSentimentFilter, setMentionSentimentFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Ingestion status: "idle" | "running" | "done" | "timeout" | "error"
  const [ingestStatus, setIngestStatus] = useState("idle");
  const pollTimerRef = useRef(null);
  const pollDeadlineRef = useRef(null);
  const baselineCountRef = useRef(null);

  // Load Dashboard Data for activeBrand
  const loadData = useCallback(async () => {
    if (!activeBrand) return;
    setLoading(true);
    try {
      const [summaryData, trendData, aspectData, mentionData] = await Promise.all([
        getBrandSummary(activeBrand.id).catch(() => null),
        getBrandTrend(activeBrand.id, trendDays).catch(() => []),
        getBrandAspects(activeBrand.id).catch(() => []),
        getBrandMentions(activeBrand.id, {
          limit: 15,
          sentiment: mentionSentimentFilter === "all" ? null : mentionSentimentFilter,
        }).catch(() => []),
      ]);

      setSummary(summaryData);
      setTrend(trendData);
      setAspects(aspectData);
      setMentions(mentionData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeBrand, trendDays, mentionSentimentFilter]);

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

  // Cleanup polling timer on unmount
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
          Add a brand or select an existing one to view sentiment insights and competitor intelligence.
        </p>
        <Link
          to="/add-brand"
          className="mt-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
        >
          + Track a New Brand
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Brand Header & Ingestion Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{activeBrand.name}</h1>
            <span className="rounded-full bg-brand/10 border border-brand/30 px-3 py-0.5 text-xs font-medium text-brand-hover">
              {activeBrand.category || "General"}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Tracking online mentions, sentiment polarity, and customer reviews in real time.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddMention}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
            >
              ✍️ Add Review / Mention
            </button>
            <button
              onClick={handleRunIngestion}
              disabled={ingestStatus === "running"}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {ingestStatus === "running" ? "🔄 Ingesting Data…" : "⚡ Run Scraper"}
            </button>
          </div>
          <IngestStatusBadge status={ingestStatus} />
        </div>
      </div>

      {/* Primary Key Metric Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sentiment Signal Gauge Dial */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-6 shadow-card">
          <SentimentGauge
            score={summary?.sentimentScore ?? activeBrand.sentimentScore}
            label="Sentiment Index"
          />
          {summary && (
            <div className="mt-4 flex w-full justify-around border-t border-border/50 pt-3 text-center text-xs">
              <div>
                <p className="font-mono font-bold text-positive">{summary.positiveMentions}</p>
                <p className="text-[10px] text-text-muted">Positive</p>
              </div>
              <div>
                <p className="font-mono font-bold text-neutral">{summary.neutralMentions}</p>
                <p className="text-[10px] text-text-muted">Neutral</p>
              </div>
              <div>
                <p className="font-mono font-bold text-negative">{summary.negativeMentions}</p>
                <p className="text-[10px] text-text-muted">Negative</p>
              </div>
            </div>
          )}
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Mentions"
            value={(summary?.mentionCount ?? activeBrand.mentionCount).toLocaleString()}
            subtitle={`${summary?.positivePct ?? 0}% positive ratio`}
            icon="💬"
          />
          <StatCard
            label="7-Day Trend"
            value={
              activeBrand.trend === "up"
                ? "Rising"
                : activeBrand.trend === "down"
                ? "Falling"
                : "Steady"
            }
            delta={Math.abs(activeBrand.trendDelta || 0)}
            deltaDirection={activeBrand.trend}
            subtitle={activeBrand.trendDelta > 0 ? "Sentiment improving" : "Sentiment stable"}
            icon="📈"
          />
          <StatCard
            label="Competitors Tracked"
            value={activeBrand.competitors?.length || 0}
            subtitle={
              activeBrand.competitorNames?.length > 0
                ? activeBrand.competitorNames.join(", ")
                : "No competitors linked"
            }
            icon="⚔️"
          />
        </div>
      </div>

      {/* Interactive Trend Chart */}
      <SentimentTrendChart
        data={trend}
        selectedDays={trendDays}
        onChangeDays={(days) => setTrendDays(days)}
      />

      {/* AI Strategy & Recommendations Engine */}
      <AiRecommendationsCard activeBrand={activeBrand} />

      {/* Lower Row: Aspect Breakdown + Recent Mentions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sentiment by Aspect */}
        <AspectBreakdown aspects={aspects} />

        {/* Recent Mentions Feed */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Recent Online Mentions</h3>

            {/* Sentiment Filter Pills */}
            <div className="flex items-center gap-1 text-xs">
              {["all", "positive", "neutral", "negative"].map((f) => (
                <button
                  key={f}
                  onClick={() => setMentionSentimentFilter(f)}
                  className={`rounded-full px-2.5 py-0.5 capitalize transition-colors ${
                    mentionSentimentFilter === f
                      ? "bg-brand text-white font-medium"
                      : "text-text-muted hover:bg-surface-hover"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-xs text-text-muted">
              Loading mentions…
            </div>
          ) : mentions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {mentions.map((m) => (
                <MentionCard key={m.id} mention={m} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center">
              <span className="text-2xl">🔍</span>
              <p className="mt-2 text-sm font-medium text-text-primary">No mentions found</p>
              <p className="text-xs text-text-muted mt-0.5">
                {mentionSentimentFilter !== "all"
                  ? `No ${mentionSentimentFilter} mentions yet. Try selecting 'All'.`
                  : "Click 'Run Scraper' or 'Add Review' to record mentions."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IngestStatusBadge({ status }) {
  if (status === "running") {
    return (
      <span className="text-xs text-brand-hover animate-pulse">
        🔄 Scraping active & competitor mentions in background…
      </span>
    );
  }
  if (status === "done") {
    return <span className="text-xs text-positive">✓ Ingestion complete! Mentions & analytics updated for active brand & competitors.</span>;
  }
  if (status === "timeout") {
    return (
      <span className="text-xs text-neutral">
        ⏳ Task running in background. Refresh in a moment.
      </span>
    );
  }
  if (status === "error") {
    return <span className="text-xs text-negative">✕ Failed to start scraper.</span>;
  }
  return null;
}