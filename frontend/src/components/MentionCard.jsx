const sentimentBadge = {
  positive: "bg-positive/10 text-positive border-positive/30",
  negative: "bg-negative/10 text-negative border-negative/30",
  neutral: "bg-neutral/10 text-neutral border-neutral/30",
};

const sentimentBorder = {
  positive: "border-l-positive",
  negative: "border-l-negative",
  neutral: "border-l-neutral",
};

const sourceIcons = {
  instagram: "📸 Instagram",
  youtube: "▶️ YouTube",
  web: "🌐 Web",
  manual: "✍️ Review",
};

export default function MentionCard({ mention, onDelete }) {
  const sentiment = (mention.sentiment || "neutral").toLowerCase();
  const sourceName = (mention.source || "web").toLowerCase();
  const sourceLabel = sourceIcons[sourceName] || `📌 ${mention.source || "Web"}`;

  return (
    <div
      className={`relative rounded-xl border border-border border-l-4 ${
        sentimentBorder[sentiment] || "border-l-neutral"
      } bg-surface p-4 shadow-sm transition-all hover:border-text-muted/40`}
    >
      {/* Header: Source, Author, Timestamp, Sentiment Tag */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-medium text-text-primary">{sourceLabel}</span>
          <span>•</span>
          <span>{mention.author || "Anonymous"}</span>
          <span>•</span>
          <span className="text-[11px]">{mention.timestamp}</span>
        </div>

        <div className="flex items-center gap-2">
          {mention.aspect && (
            <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-medium text-text-muted border border-border">
              {mention.aspect}
            </span>
          )}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
              sentimentBadge[sentiment] || sentimentBadge.neutral
            }`}
          >
            {sentiment}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(mention.id)}
              className="text-text-muted hover:text-negative transition-colors text-xs px-1"
              title="Delete mention"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Mention Text */}
      <p className="text-sm leading-relaxed text-text-primary">{mention.text}</p>

      {/* Footer: Brand name & External URL */}
      {(mention.brandName || mention.url) && (
        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-text-muted">
          {mention.brandName ? (
            <span className="font-medium text-brand-hover">Brand: {mention.brandName}</span>
          ) : (
            <span />
          )}
          {mention.url && (
            <a
              href={mention.url}
              target="_blank"
              rel="noreferrer"
              className="text-brand-hover hover:underline"
            >
              View original source ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}