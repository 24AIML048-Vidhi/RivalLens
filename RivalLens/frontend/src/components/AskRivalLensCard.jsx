import React, { useState } from "react";
import { askRivalLens } from "../services/api";

const QUICK_QUESTIONS = [
  "Why did sentiment change recently?",
  "What is our biggest weakness against competitors?",
  "What caused the recent crisis alert?",
  "What is the 7-day sentiment forecast?",
  "What recommendations should we execute immediately?",
];

export default function AskRivalLensCard({ activeBrand }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  if (!activeBrand) return null;

  async function handleAsk(questionToAsk) {
    const q = questionToAsk || query;
    if (!q || !q.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await askRivalLens(activeBrand.id, q.trim());
      setResponse(res);
    } catch (err) {
      setError(err?.message || "Failed to query AI Analyst.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🤖</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text-primary">Ask RivalLens AI Analyst</h3>
              <span className="rounded bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                Grounded Intelligence
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Ask natural language questions grounded strictly in {activeBrand.name}'s real analytics, competitors, and forecast.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-text-muted font-medium">Quick Prompts:</span>
        {QUICK_QUESTIONS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuery(prompt);
              handleAsk(prompt);
            }}
            disabled={loading}
            className="rounded-lg border border-border bg-ink/70 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:border-brand-hover transition-colors text-left"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask anything about ${activeBrand.name}'s sentiment, competitors, crisis alerts, or trends...`}
          className="flex-1 rounded-xl border border-border bg-ink px-4 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Ask Analyst"}
        </button>
      </form>

      {/* Response Display Box */}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          ✕ {error}
        </div>
      )}

      {response && (
        <div className="mt-4 rounded-xl border border-indigo-500/30 bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-2 border-b border-border/40 pb-2">
            <span>💬 Analyst Response for:</span>
            <span className="text-text-primary italic">"{response.question}"</span>
          </div>
          <div className="text-xs text-text-primary font-body leading-relaxed whitespace-pre-line">
            {response.answer}
          </div>
        </div>
      )}
    </div>
  );
}
