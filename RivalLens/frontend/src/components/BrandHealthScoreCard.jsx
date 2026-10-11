import React from "react";

const STATUS_CONFIG = {
  HEALTHY: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
    barColor: "bg-emerald-500",
  },
  STABLE: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    text: "text-amber-400",
    barColor: "bg-amber-500",
  },
  "AT RISK": {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    text: "text-rose-400",
    barColor: "bg-rose-500",
  },
};

export default function BrandHealthScoreCard({ data }) {
  if (!data) return null;

  const statusKey = data.status || "HEALTHY";
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.HEALTHY;
  const breakdown = data.breakdown || {};

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-card">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Brand Health Score
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${config.badge}`}>
            {data.status}
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className={`font-mono text-3xl font-extrabold ${config.text}`}>
            {data.health_score}
          </span>
          <span className="text-sm font-semibold text-text-muted">/ 100</span>
          <span className="ml-auto text-xs text-text-muted font-medium">
            {data.status_label || "Healthy"}
          </span>
        </div>

        {/* Component Weight Breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-text-muted border-t border-border/40 pt-3">
          <div>
            <div className="flex justify-between">
              <span>Sentiment (30%)</span>
              <span className="font-mono font-bold text-text-primary">{breakdown.sentiment ?? 50}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink mt-1">
              <div className="h-full bg-emerald-500" style={{ width: `${breakdown.sentiment ?? 50}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between">
              <span>Trend (20%)</span>
              <span className="font-mono font-bold text-text-primary">{breakdown.trend ?? 50}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink mt-1">
              <div className="h-full bg-sky-500" style={{ width: `${breakdown.trend ?? 50}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between">
              <span>Share of Voice (15%)</span>
              <span className="font-mono font-bold text-text-primary">{breakdown.share_of_voice ?? 50}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink mt-1">
              <div className="h-full bg-indigo-500" style={{ width: `${breakdown.share_of_voice ?? 50}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between">
              <span>Authenticity (15%)</span>
              <span className="font-mono font-bold text-text-primary">{breakdown.complaint_health ?? 70}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink mt-1">
              <div className="h-full bg-purple-500" style={{ width: `${breakdown.complaint_health ?? 70}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
