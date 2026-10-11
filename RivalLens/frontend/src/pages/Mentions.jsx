import { useState, useEffect, useCallback, useMemo } from "react";
import { getAllMentions, deleteMention } from "../services/api";
import MentionCard from "../components/MentionCard";

export default function Mentions({ brands = [], activeBrandId, onOpenAddMention }) {
  const [mentions, setMentions] = useState([]);
  const [total, setTotal] = useState(0);
  const [genuineCount, setGenuineCount] = useState(0);
  const [spamCount, setSpamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Active Brand reference
  const activeBrand = useMemo(() => {
    return brands.find((b) => b.id === activeBrandId) || brands[0] || null;
  }, [brands, activeBrandId]);

  // Filters
  const [selectedBrand, setSelectedBrand] = useState(activeBrandId || "");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "genuine" | "suspicious" | "spam"
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Sync with activeBrandId when it changes
  useEffect(() => {
    if (activeBrandId) {
      setSelectedBrand(activeBrandId);
    }
  }, [activeBrandId]);

  const loadMentions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllMentions({
        brandId: selectedBrand || null,
        status: statusFilter || null,
        sentiment: sentimentFilter || null,
        source: sourceFilter || null,
        q: searchQuery.trim() || null,
        limit: 50,
      });

      setMentions(data.items || []);
      setTotal(data.total || 0);

      // Extract genuine and spam counts from API response if available
      const rawSpam = data.spamCount ?? data.items?.filter((m) => m.reviewStatus === "spam" || m.spamScore > 50).length ?? 0;
      const rawGenuine = data.uniqueCount ?? data.items?.filter((m) => m.reviewStatus === "genuine" || m.spamScore <= 35).length ?? (data.total - rawSpam);
      setSpamCount(rawSpam);
      setGenuineCount(rawGenuine);
    } catch (err) {
      console.error("Failed to load mentions:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBrand, statusFilter, sentimentFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    loadMentions();
  }, [loadMentions]);

  async function handleDelete(mentionId) {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await deleteMention(mentionId);
      loadMentions();
    } catch (err) {
      alert("Failed to delete review: " + err.message);
    }
  }

  const currentViewingBrand = useMemo(() => {
    return brands.find((b) => b.id === selectedBrand) || null;
  }, [brands, selectedBrand]);

  const posCount = mentions.filter((m) => (m.sentiment || m.sentimentLabel) === "positive").length;
  const negCount = mentions.filter((m) => (m.sentiment || m.sentimentLabel) === "negative").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">Reviews & Sentiment Feed</h1>
            <span className="rounded-full bg-brand/10 border border-brand/30 px-3 py-0.5 text-xs font-semibold text-brand-hover">
              AI Spam Detection Active
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            {currentViewingBrand ? (
              <span>
                Customer reviews for <strong className="text-text-primary">{currentViewingBrand.name}</strong> with automated spam and bot detection.
              </span>
            ) : (
              <span>All collected reviews from Instagram, YouTube, and Web.</span>
            )}
          </p>
        </div>

        <button
          onClick={onOpenAddMention}
          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          + Add New Review
        </button>
      </div>

      {/* Quick Count Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
          <span className="text-[11px] text-text-muted uppercase font-medium">Total Reviews</span>
          <p className="font-mono text-xl font-bold text-text-primary mt-1">{total}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-card">
          <span className="text-[11px] text-emerald-400 uppercase font-medium">🛡️ Genuine Reviews</span>
          <p className="font-mono text-xl font-bold text-emerald-400 mt-1">{genuineCount}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 shadow-card">
          <span className="text-[11px] text-rose-400 uppercase font-medium">🚫 Spam Detected</span>
          <p className="font-mono text-xl font-bold text-rose-400 mt-1">{spamCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3.5 shadow-card">
          <span className="text-[11px] text-text-muted uppercase font-medium">Feedback Split</span>
          <p className="font-mono text-sm font-bold text-text-primary mt-1.5 flex items-center gap-2">
            <span className="text-positive">{posCount} pos</span>
            <span className="text-text-muted">•</span>
            <span className="text-negative">{negCount} neg</span>
          </p>
        </div>
      </div>

      {/* AI SPAM DETECTION ALERT BANNER */}
      {spamCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="font-bold text-rose-400">
                AI Spam Detection Filter Active
              </p>
              <p className="text-[11px] text-rose-300 mt-0.5">
                Identified {spamCount} promotional, bot, or repeated spam review(s) in the database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter("spam")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                statusFilter === "spam"
                  ? "bg-rose-500 text-white"
                  : "border border-rose-500/40 bg-surface text-rose-400 hover:bg-rose-500/20"
              }`}
            >
              View Spam Only ({spamCount})
            </button>
            <button
              onClick={() => setStatusFilter("genuine")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                statusFilter === "genuine"
                  ? "bg-emerald-500 text-white"
                  : "border border-emerald-500/40 bg-surface text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              View Genuine Only
            </button>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter("")}
                className="text-text-muted hover:underline text-[11px] px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
        {/* Search input */}
        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search review text or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-ink px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
          />
        </div>

        {/* Brand Filter */}
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="rounded-lg border border-border bg-ink px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
        >
          {activeBrand && (
            <option value={activeBrand.id}>
              🎯 {activeBrand.name} (Active)
            </option>
          )}

          {brands
            .filter((b) => b.id !== activeBrand?.id)
            .map((b) => (
              <option key={b.id} value={b.id}>
                ⚔️ {b.name}
              </option>
            ))}

          <option value="">🌐 All Brands</option>
        </select>

        {/* Spam / Quality Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-ink px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="">All Quality Status</option>
          <option value="genuine">🛡️ Genuine Reviews</option>
          <option value="suspicious">⚠️ Suspicious Content</option>
          <option value="spam">🚫 Spam / Bot Reviews</option>
        </select>

        {/* Sentiment Filter */}
        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="rounded-lg border border-border bg-ink px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="">All Sentiments</option>
          <option value="positive">🟢 Positive</option>
          <option value="neutral">🟡 Neutral</option>
          <option value="negative">🔴 Negative</option>
        </select>

        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-border bg-ink px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="">All Sources</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="reddit">Reddit</option>
          <option value="web">Web Reviews</option>
        </select>

        {(selectedBrand !== (activeBrandId || "") || statusFilter || sentimentFilter || sourceFilter || searchQuery) && (
          <button
            onClick={() => {
              setSelectedBrand(activeBrandId || "");
              setStatusFilter("");
              setSentimentFilter("");
              setSourceFilter("");
              setSearchQuery("");
            }}
            className="text-xs text-brand-hover hover:underline px-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* Mentions Feed */}
      {loading ? (
        <div className="flex h-48 items-center justify-center text-xs text-text-muted">
          Loading reviews...
        </div>
      ) : mentions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {mentions.map((m) => (
            <MentionCard key={m.id} mention={m} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-12 text-center text-text-muted">
          <span className="text-3xl mb-2">💬</span>
          <p className="font-medium text-text-primary">No matching reviews found</p>
          <p className="text-xs mt-1">Try clearing your spam filter or search query.</p>
        </div>
      )}
    </div>
  );
}