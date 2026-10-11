export default function StatCard({ label, value, delta, deltaDirection, subtitle, icon }) {
  const deltaColor =
    deltaDirection === "up"
      ? "text-positive bg-positive/10"
      : deltaDirection === "down"
      ? "text-negative bg-negative/10"
      : "text-text-muted bg-surface-hover";

  const deltaIcon = deltaDirection === "up" ? "▲" : deltaDirection === "down" ? "▼" : "•";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-card transition-all hover:border-text-muted/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
        {icon && <span className="text-base">{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xl font-bold text-text-primary">{value}</span>
        {delta !== undefined && delta !== null && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-mono ${deltaColor}`}>
            <span>{deltaIcon}</span>
            <span>{delta}%</span>
          </span>
        )}
      </div>

      {subtitle && <p className="mt-2 text-xs text-text-muted">{subtitle}</p>}
    </div>
  );
}