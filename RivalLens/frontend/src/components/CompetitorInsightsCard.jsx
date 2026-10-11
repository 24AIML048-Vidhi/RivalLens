import React from "react";

export default function CompetitorInsightsCard({ data }) {
  if (!data) return null;

  const { share_of_voice = [], strengths = [], weaknesses = [], opportunities = [] } = data;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">⚔️</span>
            <h3 className="text-base font-bold text-text-primary">Competitor Intelligence & Share of Voice</h3>
            <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand-hover">
              Market Positioning
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Identifies brand strengths, competitor weaknesses, positioning opportunities, and volume share of voice.
          </p>
        </div>
      </div>

      {/* Share of Voice Progress Section */}
      {share_of_voice.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-card p-4">
          <h4 className="text-xs font-semibold text-text-primary mb-3">Share of Voice (Market Visibility vs Sentiment)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {share_of_voice.map((item, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-ink p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-text-primary">{item.brand_name}</span>
                  <span className="font-mono text-xs font-extrabold text-brand-hover">{item.share_of_voice_pct}%</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                  <span>{item.mention_count} mentions</span>
                  <span className={`font-semibold ${item.sentiment_score >= 58 ? "text-positive" : item.sentiment_score <= 42 ? "text-negative" : "text-neutral"}`}>
                    {item.sentiment_score} pts
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Stacked Share of Voice Bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink">
            {share_of_voice.map((item, idx) => {
              const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-purple-500"];
              return (
                <div
                  key={idx}
                  className={`${colors[idx % colors.length]} transition-all`}
                  style={{ width: `${item.share_of_voice_pct}%` }}
                  title={`${item.brand_name}: ${item.share_of_voice_pct}%`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 3 Columns: Strengths, Weaknesses, Opportunities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Strengths */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="text-sm">🏆</span>
            <h4 className="text-xs font-bold uppercase tracking-wider">Strengths</h4>
          </div>
          {strengths.length > 0 ? (
            strengths.map((st, i) => (
              <div key={i} className="rounded-lg border border-emerald-500/20 bg-ink/60 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">{st.aspect}</span>
                  <span className="font-mono font-bold text-emerald-400">{st.advantage_pct}</span>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">{st.detail}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted italic">Performing within standard market baseline across all aspects.</p>
          )}
        </div>

        {/* Weaknesses */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-rose-400">
            <span className="text-sm">⚠️</span>
            <h4 className="text-xs font-bold uppercase tracking-wider">Weaknesses</h4>
          </div>
          {weaknesses.length > 0 ? (
            weaknesses.map((wk, i) => (
              <div key={i} className="rounded-lg border border-rose-500/20 bg-ink/60 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">{wk.aspect}</span>
                  <span className="font-mono font-bold text-rose-400">{wk.gap_pct}</span>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">{wk.detail}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted italic">No major aspect underperformance detected relative to rivals.</p>
          )}
        </div>

        {/* Opportunities */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="text-sm">🎯</span>
            <h4 className="text-xs font-bold uppercase tracking-wider">Opportunities</h4>
          </div>
          {opportunities.length > 0 ? (
            opportunities.map((op, i) => (
              <div key={i} className="rounded-lg border border-amber-500/20 bg-ink/60 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">{op.aspect}</span>
                  <span className="font-mono font-bold text-amber-400">vs {op.competitor}</span>
                </div>
                <p className="mt-1 text-[11px] text-text-muted">{op.opportunity}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted italic">No active competitor gaps identified at present.</p>
          )}
        </div>
      </div>
    </div>
  );
}
