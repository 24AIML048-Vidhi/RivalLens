import React from "react";

export default function RootCauseCard({ data }) {
  if (!data || !data.causes || data.causes.length === 0) return null;

  const isOverallNegative = (data.overall_change || 0) < 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🔍</span>
            <h3 className="text-base font-bold text-text-primary">Root-Cause Analysis</h3>
            <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand-hover">
              Aspect Attribution
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Explains key aspect drivers behind overall sentiment shifts.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-text-muted">Overall Sentiment Delta: </span>
            <span
              className={`font-mono font-bold ${
                isOverallNegative ? "text-negative" : "text-positive"
              }`}
            >
              {data.overall_change > 0 ? `+${data.overall_change}%` : `${data.overall_change}%`}
            </span>
          </div>
          <div className="rounded-lg bg-surface-card border border-border px-3 py-1">
            <span className="text-text-muted">Primary Cause: </span>
            <span className="font-bold text-text-primary">{data.primary_cause}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {data.causes.map((item, index) => {
          const isNegShift = (item.sentiment_change || 0) < 0;
          return (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-text-primary">{item.aspect}</span>
                  <span className="rounded bg-ink border border-border px-2 py-0.5 font-mono text-[11px] text-brand-hover">
                    {item.contribution}% Contribution
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-text-muted">Sentiment Delta: </span>
                    <span
                      className={`font-mono font-semibold ${
                        isNegShift ? "text-negative" : "text-positive"
                      }`}
                    >
                      {item.sentiment_change > 0
                        ? `+${item.sentiment_change}%`
                        : `${item.sentiment_change}%`}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Volume Shift: </span>
                    <span className="font-mono text-text-primary font-medium">
                      {item.mention_change > 0 ? `+${item.mention_change}%` : `${item.mention_change}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar visualizing aspect contribution */}
              <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-ink">
                  <div
                    className={`h-full transition-all ${
                      isNegShift ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, item.contribution))}%` }}
                  />
                </div>
                <span className="font-mono text-[11px]">
                  {item.positive_count} pos / {item.negative_count} neg ({item.mention_count} total)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
