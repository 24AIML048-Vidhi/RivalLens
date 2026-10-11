import React from "react";

export default function ViralComplaintsCard({ complaints = [] }) {
  if (!complaints || complaints.length === 0) return null;

  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-card">
      <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <h3 className="text-base font-bold text-text-primary">Potential Viral Complaints</h3>
          <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-xs font-bold text-rose-400">
            {complaints.length} Detected
          </span>
        </div>
        <span className="text-xs text-text-muted">Real-Time Social Propagation Alert</span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {complaints.map((c) => {
          const isHighRisk = c.risk === "HIGH";
          return (
            <div
              key={c.id}
              className={`flex flex-col gap-2 rounded-xl border p-4 transition-all ${
                isHighRisk
                  ? "border-rose-500/40 bg-surface-card hover:border-rose-500"
                  : "border-border bg-surface-card"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary">{c.author}</span>
                  <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-text-muted">
                    {c.source.toUpperCase()} {c.source_ref ? `(${c.source_ref})` : ""}
                  </span>
                  {c.aspect && (
                    <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-medium text-brand-hover">
                      {c.aspect}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-rose-400 font-bold">
                    Negative: {c.negative_sentiment}%
                  </span>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    Growth: {c.growth}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      isHighRisk
                        ? "bg-rose-500/20 text-rose-400 border-rose-500/50"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/50"
                    }`}
                  >
                    Risk: {c.risk}
                  </span>
                </div>
              </div>

              <p className="text-xs text-text-primary font-body leading-relaxed border-l-2 border-rose-500/50 pl-3 italic">
                "{c.text}"
              </p>

              <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                <span>Language: {c.language} • Clustered Duplicates: {c.duplicate_count}</span>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-hover hover:underline"
                  >
                    View Original Post ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
