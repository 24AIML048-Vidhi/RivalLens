import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

export default function SentimentForecastChart({ data }) {
  if (!data) return null;

  const { historical = [], forecast = [], current_sentiment, predicted_sentiment, expected_change, disclaimer } = data;

  // Combine historical and forecast into a single timeline series
  const combinedData = [];

  historical.forEach((h) => {
    combinedData.push({
      date: h.date,
      actual: h.sentiment,
      predicted: null,
    });
  });

  if (historical.length > 0 && forecast.length > 0) {
    // Bridge point: last historical date has both actual and predicted for seamless line transition
    const lastHist = historical[historical.length - 1];
    combinedData[combinedData.length - 1].predicted = lastHist.sentiment;
  }

  forecast.forEach((f) => {
    combinedData.push({
      date: f.date,
      actual: null,
      predicted: f.sentiment,
    });
  });

  const isPositiveExpected = (expected_change || 0) >= 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🔮</span>
            <h3 className="text-base font-bold text-text-primary">7-Day Sentiment Forecast</h3>
            <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-semibold text-brand-hover">
              Predictive AI
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Predicts future sentiment trajectory over the next 7 days.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-text-muted">Current: </span>
            <span className="font-mono font-bold text-text-primary">{current_sentiment}</span>
          </div>
          <div>
            <span className="text-text-muted">Predicted: </span>
            <span className="font-mono font-bold text-brand-hover">{predicted_sentiment}</span>
          </div>
          <div className="rounded-lg bg-surface-card border border-border px-2.5 py-1">
            <span className="text-text-muted">Expected Change: </span>
            <span
              className={`font-mono font-bold ${
                isPositiveExpected ? "text-positive" : "text-negative"
              }`}
            >
              {isPositiveExpected ? `+${expected_change}` : expected_change} pts
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={combinedData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" opacity={0.5} />
            <XAxis dataKey="date" stroke="#A0AEC0" fontSize={11} tickLine={false} />
            <YAxis domain={[0, 100]} stroke="#A0AEC0" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1A202C",
                borderColor: "#2D3748",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#EDF2F7",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
            {historical.length > 0 && (
              <ReferenceLine
                x={historical[historical.length - 1].date}
                stroke="#A0AEC0"
                strokeDasharray="2 2"
                label={{ value: "Past | Next", fill: "#A0AEC0", fontSize: 10, position: "top" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="actual"
              name="Past 7 Days (Actual)"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 4, fill: "#10B981" }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="predicted"
              name="Next 7 Days (Predicted)"
              stroke="#6366F1"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: "#6366F1" }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-2 text-[11px] text-text-muted">
        <span>🟢 Actual Sentiment Index (0-100)</span>
        <span className="italic font-medium">«{disclaimer || "Forecast based on historical sentiment trends."}»</span>
        <span>🟣 Predictive Moving Projection</span>
      </div>
    </div>
  );
}
