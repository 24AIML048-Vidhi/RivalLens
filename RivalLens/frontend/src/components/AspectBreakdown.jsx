export default function AspectBreakdown({ aspects = [] }) {
  const hasData = aspects && aspects.length > 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Sentiment by Aspect</h3>
          <p className="text-xs text-text-muted">Feature & category sentiment breakdown</p>
        </div>
        {hasData && (
          <span className="text-xs text-text-muted">{aspects.length} aspects analyzed</span>
        )}
      </div>

      {hasData ? (
        <div className="flex flex-col gap-4">
          {aspects.map((a) => (
            <div key={a.aspect} className="rounded-lg border border-border/50 bg-ink/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{a.aspect}</span>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-positive">{a.positive}% pos</span>
                  <span className="text-text-muted">•</span>
                  <span className="text-neutral">{a.neutral}% neu</span>
                  <span className="text-text-muted">•</span>
                  <span className="text-negative">{a.negative}% neg</span>
                </div>
              </div>
              
              {/* Stacked Progress Bar */}
              <div className="flex h-2.5 overflow-hidden rounded-full bg-ink">
                <div
                  className="bg-positive transition-all duration-500"
                  style={{ width: `${a.positive}%` }}
                  title={`Positive: ${a.positive}%`}
                />
                <div
                  className="bg-neutral transition-all duration-500"
                  style={{ width: `${a.neutral}%` }}
                  title={`Neutral: ${a.neutral}%`}
                />
                <div
                  className="bg-negative transition-all duration-500"
                  style={{ width: `${a.negative}%` }}
                  title={`Negative: ${a.negative}%`}
                />
              </div>

              {a.mentionCount !== undefined && (
                <p className="mt-1.5 text-[11px] text-text-muted">
                  {a.mentionCount} total mention{a.mentionCount === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center text-center">
          <p className="text-sm text-text-muted">No aspect data detected yet</p>
          <p className="text-xs text-text-muted mt-1">Aspects are automatically tagged during ingestion</p>
        </div>
      )}
    </div>
  );
}