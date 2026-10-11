import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const PERIOD_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "14 Days", value: 14 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "All Time", value: null },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const scoreData = payload.find((p) => p.dataKey === "score");
  const volumeData = payload.find((p) => p.dataKey === "mentionCount");

  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-lg">
      <p className="text-xs font-semibold text-text-primary">{label}</p>
      {scoreData && (
        <p className="mt-1 font-mono text-xs text-brand-hover">
          Sentiment: <span className="font-bold">{scoreData.value}</span> / 100
        </p>
      )}
      {volumeData && (
        <p className="font-mono text-xs text-text-muted">
          Mentions: <span className="font-bold text-text-primary">{volumeData.value}</span>
        </p>
      )}
    </div>
  );
}

export default function SentimentTrendChart({ data = [], selectedDays = 14, onChangeDays }) {
  const hasData = data && data.length > 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      {/* Header with Title and Interactive Range Buttons */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Sentiment & Volume Trend</h3>
          <p className="text-xs text-text-muted">Daily sentiment score and volume</p>
        </div>

        {/* Period Selector Buttons */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-ink p-1">
          {PERIOD_OPTIONS.map((opt) => {
            const isSelected = selectedDays === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => onChangeDays && onChangeDays(opt.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-brand text-white font-semibold"
                    : "text-text-muted hover:text-text-primary hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#262B3A" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#8B92A8"
              tick={{ fontSize: 11, fill: "#8B92A8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              stroke="#8B92A8"
              tick={{ fontSize: 11, fill: "#8B92A8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#8B92A8"
              tick={{ fontSize: 11, fill: "#8B92A8" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Mention Volume Bar */}
            <Bar
              yAxisId="right"
              dataKey="mentionCount"
              fill="#6C5CE7"
              fillOpacity={0.2}
              radius={[4, 4, 0, 0]}
              barSize={16}
            />
            {/* Sentiment Score Line */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="score"
              stroke="#6C5CE7"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#6C5CE7" }}
              activeDot={{ r: 5, fill: "#7C6EF0" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-56 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-text-muted">No trend data for this period</p>
          <p className="text-xs text-text-muted">Try selecting "All Time" or run an ingestion to pull new mentions</p>
        </div>
      )}
    </div>
  );
}