import { useState, useEffect, useCallback, useMemo } from "react";
import { getAllMentions, deleteMention } from "../services/api";
import MentionCard from "../components/MentionCard";

export default function Mentions({ brands = [], activeBrandId, onOpenAddMention }) {
  const [mentions, setMentions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Active Brand reference
  const activeBrand = useMemo(() => {
    return brands.find((b) => b.id === activeBrandId) || brands[0] || null;
  }, [brands, activeBrandId]);

  // Filters - default to active brand
  const [selectedBrand, setSelectedBrand] = useState(activeBrandId || "");
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
        sentiment: sentimentFilter || null,
        source: sourceFilter || null,
        q: searchQuery.trim() || null,
        limit: 50,
      });
      setMentions(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load mentions:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBrand, sentimentFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    loadMentions();
  }, [loadMentions]);

  async function handleDelete(mentionId) {
    if (!window.confirm("Are you sure you want to delete this mention?")) return;
    try {
      await deleteMention(mentionId);
      loadMentions();
    } catch (err) {
      alert("Failed to delete mention: " + err.message);
    }
  }

  const currentViewingBrand = useMemo(() => {
    return brands.find((b) => b.id === selectedBrand) || null;
  }, [brands, selectedBrand]);

  const isCompetitorView =
    currentViewingBrand &&
    activeBrand &&
    currentViewingBrand.id !== activeBrand.id;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Online Mentions & Reviews</h1>
          <p className="text-sm text-text-muted">
            {isCompetitorView ? (
              <span>
                Viewing competitor chatter for <strong className="text-brand-hover">{currentViewingBrand.name}</strong> to inspect rival market performance.
              </span>
            ) : activeBrand ? (
              <span>
                Showing raw consumer mentions for active brand <strong className="text-text-primary">{activeBrand.name}</strong> across Instagram, YouTube, and user reviews.
              </span>
            ) : (
              <span>Explore raw mentions scraped from Instagram, YouTube, and user reviews.</span>
            )}
          </p>
        </div>

        <button
          onClick={onOpenAddMention}
          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          + Add New Mention
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
        {/* Search input */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search mention text or keywords…"
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
              🎯 {activeBrand.name} (Active Brand)
            </option>
          )}
          
          {brands
            .filter((b) => b.id !== activeBrand?.id)
            .map((b) => (
              <option key={b.id} value={b.id}>
                ⚔️ {b.name} (Competitor)
              </option>
            ))}

          <option value="">🌐 All Tracked Mentions</option>
        </select>

        {/* Sentiment Filter */}
        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="rounded-lg border border-border bg-ink px-3 py-1.5 text-xs font-medium text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
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
          <option value="web">Web</option>
          <option value="manual">Manual / Reviews</option>
        </select>

        {(selectedBrand !== (activeBrandId || "") || sentimentFilter || sourceFilter || searchQuery) && (
          <button
            onClick={() => {
              setSelectedBrand(activeBrandId || "");
              setSentimentFilter("");
              setSourceFilter("");
              setSearchQuery("");
            }}
            className="text-xs text-text-muted hover:text-text-primary hover:underline px-1"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Active Filter Notice */}
      {isCompetitorView && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-xs flex items-center justify-between">
          <span>
            🔍 Currently inspecting competitor mentions for <strong>{currentViewingBrand.name}</strong>.
          </span>
          <button
            type="button"
            onClick={() => setSelectedBrand(activeBrand?.id || "")}
            className="text-brand hover:underline font-semibold"
          >
            Switch back to Active Brand ({activeBrand?.name}) →
          </button>
        </div>
      )}

      {/* Mentions Feed */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-text-muted">
          Loading mentions…
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
          <p className="font-medium text-text-primary">No mentions found</p>
          <p className="text-xs mt-1">
            Try adjusting your filters or click "+ Add New Mention" to manually record customer feedback.
          </p>
        </div>
      )}
    </div>
  );
}