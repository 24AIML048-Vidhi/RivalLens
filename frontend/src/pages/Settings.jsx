import { useState, useEffect } from "react";
import { checkHealth } from "../services/api";

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Health check failed:", err);
        setHealth({ status: "offline", error: err.message });
        setLoading(false);
      });
  }, []);

  const isOnline = health?.status === "ok";

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">System Status & Architecture</h1>
        <p className="text-sm text-text-muted mt-1">
          Real-time status of RivalLens backend, SQLite database, NLP pipelines, and API integrations.
        </p>
      </div>

      {/* Backend & Database Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs uppercase tracking-wider text-text-muted">FastAPI Backend</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline ? "bg-positive animate-pulse" : "bg-negative"
              }`}
            />
            <span className="font-mono text-lg font-bold text-text-primary">
              {loading ? "Checking…" : isOnline ? "Online (v1.0.0)" : "Offline"}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">Host: 127.0.0.1:8000</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs uppercase tracking-wider text-text-muted">SQLite Database</p>
          <p className="mt-2 font-mono text-lg font-bold text-text-primary">
            {health?.database?.status === "connected" ? "Connected" : "Disconnected"}
          </p>
          <p className="mt-1 text-xs text-text-muted">File: rivallens.db</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <p className="text-xs uppercase tracking-wider text-text-muted">Total Stored Data</p>
          <p className="mt-2 font-mono text-lg font-bold text-brand-hover">
            {health?.database?.brandsTracked ?? 0} Brands · {health?.database?.totalMentions ?? 0} Mentions
          </p>
          <p className="mt-1 text-xs text-text-muted">Persisted in SQLite</p>
        </div>
      </div>

      {/* College Project Architecture Guide */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-base font-bold text-text-primary">🎓 Project Architecture & Technical Stack</h2>
        <p className="text-xs text-text-muted mt-1">
          Summary of components and layers used across the RivalLens application.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border border-border bg-ink/50 p-4">
            <h3 className="font-semibold text-text-primary">🐍 Backend Framework</h3>
            <p className="text-text-muted mt-1 leading-relaxed">
              Built with Python, FastAPI, and SQLAlchemy ORM. Provides RESTful endpoints with clean Pydantic data validation and CORS support.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-ink/50 p-4">
            <h3 className="font-semibold text-text-primary">🧠 NLP & Sentiment Engine</h3>
            <p className="text-text-muted mt-1 leading-relaxed">
              Multi-strategy sentiment analysis module that calculates 0-100 polarity scores and classifies mentions into Positive, Neutral, and Negative.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-ink/50 p-4">
            <h3 className="font-semibold text-text-primary">🌐 Scrapers & Data Sources</h3>
            <p className="text-text-muted mt-1 leading-relaxed">
              Modular data ingestion pipeline integrating Instagram Graph API and YouTube Data API v3 to pull social chatter, reels, and video comments.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-ink/50 p-4">
            <h3 className="font-semibold text-text-primary">⚛️ Frontend User Interface</h3>
            <p className="text-text-muted mt-1 leading-relaxed">
              Responsive React 19 + Vite dashboard featuring Recharts analytics, brand management, mentions feed, and side-by-side competitor benchmarking.
            </p>
          </div>
        </div>
      </div>

      {/* API Endpoints Reference Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Interactive API Documentation</h2>
            <p className="text-xs text-text-muted mt-1">
              FastAPI generates interactive Swagger OpenAPI documentation for testing all backend routes.
            </p>
          </div>
          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            Open Swagger /docs ↗
          </a>
        </div>
      </div>
    </div>
  );
}