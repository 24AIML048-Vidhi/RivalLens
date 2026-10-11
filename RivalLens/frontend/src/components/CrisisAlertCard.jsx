import React from "react";

const SEVERITY_CONFIG = {
  SAFE: {
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: "🟢",
    label: "Safe",
    bgCard: "border-emerald-500/20 bg-emerald-500/5",
  },
  LOW: {
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    icon: "🟡",
    label: "Low Risk",
    bgCard: "border-yellow-500/20 bg-yellow-500/5",
  },
  MEDIUM: {
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    icon: "🟠",
    label: "Medium Risk",
    bgCard: "border-amber-500/20 bg-amber-500/5",
  },
  HIGH: {
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    icon: "🔴",
    label: "High Risk",
    bgCard: "border-rose-500/20 bg-rose-500/5",
  },
  CRITICAL: {
    badgeClass: "bg-red-600/20 text-red-400 border-red-500/50 animate-pulse",
    icon: "🚨",
    label: "Critical Crisis",
    bgCard: "border-red-500/30 bg-red-500/10",
  },
};

export default function CrisisAlertCard({ data }) {
  if (!data) return null;

  const severityKey = (data.severity || "SAFE").toUpperCase();
  const config = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG.SAFE;

  return (
    <div className={`rounded-2xl border p-5 shadow-card ${config.bgCard}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{config.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text-primary">AI Crisis Detection</h3>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.badgeClass}`}>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Period: {data.analysis_period || "Past 7 days"}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-extrabold text-text-primary">
              {data.crisis_score}
            </span>
            <span className="text-xs text-text-muted">/100</span>
          </div>
          <p className="text-[11px] font-medium text-text-muted">Crisis Score</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Primary Diagnosis</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.main_reason || "Normal operational parameters"}
          </p>
          {data.top_contributing_aspect && (
            <p className="mt-1 text-xs text-text-muted">
              Top Aspect Spike: <span className="font-semibold text-brand-hover">{data.top_contributing_aspect}</span>
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Surge Metrics</p>
          <div className="mt-1 flex items-center gap-3">
            <div>
              <span className="text-xs text-text-muted">Shift Delta: </span>
              <span className={`font-mono text-xs font-bold ${data.change_percentage > 0 ? "text-negative" : "text-positive"}`}>
                {data.change_percentage > 0 ? `+${data.change_percentage}%` : `${data.change_percentage}%`}
              </span>
            </div>
            <div>
              <span className="text-xs text-text-muted">Status: </span>
              <span className="text-xs font-medium text-text-primary">{data.status}</span>
            </div>
          </div>
        </div>
      </div>

      {data.contributing_factors && data.contributing_factors.length > 0 && (
        <div className="mt-4 border-t border-border/30 pt-3">
          <p className="text-[11px] font-medium text-text-muted mb-1.5">Contributing Crisis Signals:</p>
          <ul className="flex flex-col gap-1">
            {data.contributing_factors.map((factor, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
