function scoreToColor(score) {
  if (score >= 58) return "#34D399"; // positive (emerald)
  if (score <= 42) return "#F87171"; // negative (coral)
  return "#FBBF24"; // neutral (amber)
}

function scoreToLabel(score) {
  if (score >= 58) return { text: "Positive", color: "text-positive" };
  if (score <= 42) return { text: "Negative", color: "text-negative" };
  return { text: "Neutral", color: "text-neutral" };
}

export default function SentimentGauge({ score = 50, label = "Overall Sentiment" }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score || 50));
  const progress = (clampedScore / 100) * circumference;
  const color = scoreToColor(clampedScore);
  const sentiment = scoreToLabel(clampedScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#262B3A"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-text-primary">{clampedScore}</span>
          <span className="text-[11px] text-text-muted">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className={`text-xs font-semibold uppercase tracking-wider ${sentiment.color}`}>
          {sentiment.text}
        </p>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
    </div>
  );
}