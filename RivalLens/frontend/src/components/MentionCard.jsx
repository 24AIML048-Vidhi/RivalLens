export default function MentionCard({ mention, onDelete }) {
  const sentiment = (mention.sentiment || mention.sentimentLabel || "neutral").toLowerCase();
  const sourceName = (mention.source || "web").toLowerCase();
  
  // Review Quality / Spam detection
  const status = (mention.reviewStatus || (mention.spamScore > 50 ? "spam" : "genuine")).toLowerCase();
  const isSpam = status === "spam";
  const isSuspicious = status === "suspicious";

  const sourceLabels = {
    instagram: "📸 Instagram",
    youtube: "▶️ YouTube",
    reddit: "🤖 Reddit",
    web: "🌐 Web",
    manual: "✍️ Review",
  };

  const sentimentStyles = {
    positive: {
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      border: "border-l-emerald-500",
    },
    negative: {
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      border: "border-l-rose-500",
    },
    neutral: {
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      border: "border-l-amber-500",
    },
    mixed: {
      badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      border: "border-l-purple-500",
    },
  };

  const style = sentimentStyles[sentiment] || sentimentStyles.neutral;

  return (
    <div
      className={`relative rounded-xl border ${
        isSpam ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-surface"
      } border-l-4 ${style.border} p-4 shadow-sm transition-all hover:border-text-muted/40`}
    >
      {/* Header: Source, Author, Timestamp & Sentiment */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-semibold text-text-primary">
            {sourceLabels[sourceName] || `📌 ${mention.source || "Web"}`}
          </span>
          <span>•</span>
          <span>{mention.author || "User Review"}</span>
          {mention.timestamp && (
            <>
              <span>•</span>
              <span className="text-[11px]">{mention.timestamp}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Spam / Authenticity Tag */}
          {isSpam ? (
            <span
              className="rounded-full border border-rose-500/50 bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-400"
              title="Flagged by AI Spam Detector as promotional or bot review"
            >
              🚫 Spam Review
            </span>
          ) : isSuspicious ? (
            <span
              className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400"
              title="Suspicious repetitive or template review"
            >
              ⚠️ Suspicious
            </span>
          ) : (
            <span
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400"
              title="Verified genuine customer review"
            >
              🛡️ Genuine
            </span>
          )}

          {/* Aspect Tag */}
          {mention.aspect && (
            <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-medium text-text-muted border border-border">
              🏷️ {mention.aspect}
            </span>
          )}

          {/* Sentiment Tag */}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${style.badge}`}
          >
            {sentiment}
          </span>

          {onDelete && (
            <button
              onClick={() => onDelete(mention.id)}
              className="text-text-muted hover:text-negative transition-colors text-xs px-1"
              title={isSpam ? "Delete spam review" : "Delete review"}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Review Text */}
      <p className="text-sm leading-relaxed text-text-primary">
        "{mention.text}"
      </p>

      {/* If Spam, show warning explanation */}
      {isSpam && (
        <div className="mt-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-300 flex items-center justify-between">
          <span>⚠️ AI detected promotional keywords, links, or bot template pattern.</span>
          {onDelete && (
            <button
              onClick={() => onDelete(mention.id)}
              className="font-bold underline hover:text-white ml-2"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Footer: Brand name */}
      {mention.brandName && (
        <div className="mt-2 text-[11px] text-text-muted">
          Brand: <span className="font-medium text-brand-hover">{mention.brandName}</span>
        </div>
      )}
    </div>
  );
}