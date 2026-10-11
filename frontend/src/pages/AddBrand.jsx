import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBrand,
  getCompetitorSuggestions,
  addCompetitor,
} from "../services/api";

const COMPETITOR_MODE = {
  MANUAL: "manual",
  AUTO: "auto",
};

const POPULAR_CATEGORIES = [
  "Quick Commerce",
  "Food Delivery",
  "E-Commerce",
  "FinTech",
  "Streaming / OTT",
  "SaaS / Productivity",
  "Sportswear",
  "Fashion",
  "Beverages",
  "EdTech",
  "Ride Hailing",
];

export default function AddBrand({
  brands = [],
  onBrandAdded,
  onRefreshBrands,
}) {
  const navigate = useNavigate();

  // Brand Info State
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  // Competitor Strategy Mode: manual vs auto
  const [competitorMode, setCompetitorMode] = useState(COMPETITOR_MODE.AUTO);
  const [suggestionCount, setSuggestionCount] = useState(2);

  // Manual Mode State
  const [manualInput, setManualInput] = useState("");
  const [manualCompetitors, setManualCompetitors] = useState([]);

  // Auto Mode State
  const [suggestedCompetitors, setSuggestedCompetitors] = useState([]);
  const [selectedSuggestedNames, setSelectedSuggestedNames] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /*
   * Existing tracked brands excluding current brand name.
   */
  const availableBrands = useMemo(() => {
    const currentName = brandName.trim().toLowerCase();
    return brands.filter(
      (brand) => brand.name?.toLowerCase() !== currentName
    );
  }, [brands, brandName]);

  /*
   * Auto-suggest competitors based on brand name and category.
   */
  async function handleAutoSuggest(targetCount = suggestionCount) {
    const trimmedName = brandName.trim();
    if (!trimmedName) {
      setError("Please enter a Brand Name first to auto-generate competitors.");
      return;
    }

    setError("");
    setLoadingSuggestions(true);

    try {
      const data = await getCompetitorSuggestions(
        trimmedName,
        category.trim(),
        targetCount
      );

      const suggestions = Array.isArray(data)
        ? data
        : data?.suggestions || data?.competitors || [];

      setSuggestedCompetitors(suggestions);

      // Auto-select all returned suggested competitors up to count
      const names = suggestions
        .slice(0, targetCount)
        .map((c) => c.name)
        .filter(Boolean);

      setSelectedSuggestedNames(names);
    } catch (err) {
      console.error("Failed to auto-suggest competitors:", err);
      setError(
        err?.message || "Could not analyze and generate competitor suggestions."
      );
      setSuggestedCompetitors([]);
      setSelectedSuggestedNames([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  /*
   * Add a manual competitor (either typed or clicked from library).
   */
  function handleAddManualCompetitor(customName = null) {
    const nameToAdd = (customName || manualInput).trim();
    if (!nameToAdd) return;

    if (nameToAdd.toLowerCase() === brandName.trim().toLowerCase()) {
      setError("A brand cannot be added as its own competitor.");
      return;
    }

    const alreadyAdded = manualCompetitors.some(
      (c) => c.name.toLowerCase() === nameToAdd.toLowerCase()
    );

    if (alreadyAdded) {
      setError(`'${nameToAdd}' is already in your competitor list.`);
      return;
    }

    // Check if it exists in tracked brands
    const matchedBrand = availableBrands.find(
      (b) => b.name.toLowerCase() === nameToAdd.toLowerCase()
    );

    setManualCompetitors((prev) => [
      ...prev,
      {
        name: matchedBrand ? matchedBrand.name : nameToAdd,
        id: matchedBrand ? matchedBrand.id : null,
        category: matchedBrand ? matchedBrand.category : category.trim() || "General",
        tracked: !!matchedBrand,
      },
    ]);

    if (!customName) {
      setManualInput("");
    }
    setError("");
  }

  /*
   * Remove a manual competitor chip.
   */
  function handleRemoveManualCompetitor(nameToRemove) {
    setManualCompetitors((prev) =>
      prev.filter((c) => c.name.toLowerCase() !== nameToRemove.toLowerCase())
    );
  }

  /*
   * Toggle a suggested competitor in Auto mode.
   */
  function handleToggleSuggestedName(name) {
    setSelectedSuggestedNames((prev) => {
      if (prev.includes(name)) {
        return prev.filter((n) => n !== name);
      }
      if (prev.length >= suggestionCount) {
        return [...prev.slice(1), name];
      }
      return [...prev, name];
    });
  }

  /*
   * Handle Count Change (2 or 3)
   */
  function handleCountChange(count) {
    setSuggestionCount(count);
    if (competitorMode === COMPETITOR_MODE.AUTO && brandName.trim()) {
      handleAutoSuggest(count);
    }
  }

  /*
   * Form Submission: Create Brand + Link Competitors + Navigate to Comparison
   */
  async function handleSubmit(e) {
    e.preventDefault();

    const trimmedName = brandName.trim();
    if (!trimmedName) {
      setError("Brand Name is required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Determine final competitor names list based on active mode
      let finalCompetitorNames = [];

      if (competitorMode === COMPETITOR_MODE.MANUAL) {
        finalCompetitorNames = manualCompetitors.map((c) => c.name);
      } else {
        finalCompetitorNames = selectedSuggestedNames;
      }

      // Step 1: Create the new Brand (and pass competitorNames for automatic backend linking)
      const createdBrandResponse = await createBrand({
        name: trimmedName,
        category: category.trim() || null,
        description: description.trim() || null,
        competitorNames: finalCompetitorNames,
      });

      const newBrand = createdBrandResponse?.brand || createdBrandResponse;

      if (!newBrand?.id) {
        throw new Error("Brand created, but no valid brand ID was returned.");
      }

      // Step 2: Ensure any manually selected existing IDs are directly linked if not caught by name
      if (competitorMode === COMPETITOR_MODE.MANUAL) {
        for (const comp of manualCompetitors) {
          if (comp.id) {
            try {
              await addCompetitor(newBrand.id, comp.id);
            } catch (linkErr) {
              console.warn("Direct competitor link warning:", linkErr);
            }
          }
        }
      }

      // Step 3: Refresh global brands list and notify parent
      if (typeof onBrandAdded === "function") {
        onBrandAdded(newBrand);
      }
      if (typeof onRefreshBrands === "function") {
        await onRefreshBrands();
      }

      // Step 4: Navigate directly to the Comparison page for this brand
      navigate("/comparison");
    } catch (err) {
      console.error("Failed to create brand:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to create brand and configure competitors."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
        >
          ← Back to Brands
        </button>

        <h1 className="text-2xl font-bold text-text-primary">Add New Brand</h1>
        <p className="mt-1 text-sm text-text-muted">
          Register a brand and choose whether to manually enter custom rivals or auto-analyze 2–3 similar category competitors.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================
            SECTION 1: BRAND INFORMATION
            ======================================================== */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <span>🏷️</span> Brand Details
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Brand Name *
              </label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.target.value);
                  setSuggestedCompetitors([]);
                  setSelectedSuggestedNames([]);
                }}
                placeholder="e.g. Zepto, Zomato, Nike, Notion"
                className="w-full rounded-xl border border-border bg-ink px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Category / Industry
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSuggestedCompetitors([]);
                }}
                placeholder="e.g. Quick Commerce, Food Delivery, FinTech"
                className="w-full rounded-xl border border-border bg-ink px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Quick Category Pills */}
          <div className="mt-4">
            <p className="text-[11px] font-medium text-text-muted mb-2">Quick Category Presets:</p>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setSuggestedCompetitors([]);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    category.toLowerCase() === cat.toLowerCase()
                      ? "bg-brand/20 text-brand border border-brand/40 font-semibold"
                      : "border border-border/70 bg-ink/60 text-text-muted hover:border-brand/40 hover:text-text-primary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the brand's key offerings..."
              className="w-full resize-none rounded-xl border border-border bg-ink px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-colors"
            />
          </div>
        </section>

        {/* ========================================================
            SECTION 2: COMPETITOR SELECTION MODE
            ======================================================== */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <span>⚔️</span> Competitor Setup Strategy
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                Choose how you want to associate rivals for this brand.
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-xl border border-border bg-ink p-1">
              <button
                type="button"
                onClick={() => setCompetitorMode(COMPETITOR_MODE.AUTO)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  competitorMode === COMPETITOR_MODE.AUTO
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span>✨</span> Auto-Analyze (2–3 Rivals)
              </button>

              <button
                type="button"
                onClick={() => setCompetitorMode(COMPETITOR_MODE.MANUAL)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  competitorMode === COMPETITOR_MODE.MANUAL
                    ? "bg-brand text-white shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span>✍️</span> Enter Custom Competitors
              </button>
            </div>
          </div>

          {/* ======================================================
              MODE 1: AUTO-ANALYZE (2 OR 3 COMPETITORS)
              ====================================================== */}
          {competitorMode === COMPETITOR_MODE.AUTO && (
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    AI & Category Competitor Analyzer
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Automatically discovers the closest market rivals based on category & domain intelligence.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-muted">Rivals Count:</span>
                  {[2, 3].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleCountChange(count)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        suggestionCount === count
                          ? "bg-brand text-white shadow-sm"
                          : "border border-border bg-ink text-text-muted hover:border-brand hover:text-text-primary"
                      }`}
                    >
                      {count} Rivals
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => handleAutoSuggest(suggestionCount)}
                    disabled={loadingSuggestions || !brandName.trim()}
                    className="ml-2 rounded-lg bg-brand-hover px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loadingSuggestions ? "Analyzing..." : "🔍 Auto-Discover"}
                  </button>
                </div>
              </div>

              {/* Suggestions Grid */}
              {suggestedCompetitors.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Discovered Competitor Candidates ({selectedSuggestedNames.length}/{suggestionCount} Selected)
                    </p>
                    <span className="text-xs text-brand">Click card to select / deselect</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {suggestedCompetitors.map((comp) => {
                      const isSelected = selectedSuggestedNames.includes(comp.name);
                      return (
                        <div
                          key={comp.name}
                          onClick={() => handleToggleSuggestedName(comp.name)}
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            isSelected
                              ? "border-brand bg-brand/10 shadow-md ring-1 ring-brand"
                              : "border-border bg-ink/60 hover:border-brand/40"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-text-primary">{comp.name}</h4>
                              <span className="mt-1 inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-medium text-text-muted border border-border/50">
                                {comp.category || "General"}
                              </span>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                isSelected ? "bg-brand text-white" : "border border-border text-text-muted"
                              }`}
                            >
                              {isSelected ? "✓ Selected" : "+ Add"}
                            </span>
                          </div>

                          {comp.reason && (
                            <p className="mt-2.5 text-xs text-text-muted line-clamp-2">
                              {comp.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-ink/40 p-6 text-center">
                  <span className="text-2xl">✨</span>
                  <p className="mt-2 text-xs font-medium text-text-primary">
                    Ready to discover competitors
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted max-w-sm mx-auto">
                    Type a Brand Name and Category above, then click <strong>Auto-Discover</strong> to instantly pull 2 or 3 market rivals.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ======================================================
              MODE 2: MANUAL COMPETITOR ENTRY
              ====================================================== */}
          {competitorMode === COMPETITOR_MODE.MANUAL && (
            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Add Competitor Brand Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddManualCompetitor();
                      }
                    }}
                    placeholder="e.g. Swiggy, Blinkit, DoorDash"
                    className="flex-1 rounded-xl border border-border bg-ink px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddManualCompetitor()}
                    className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    + Add Competitor
                  </button>
                </div>
              </div>

              {/* Selected Manual Competitors Chips */}
              {manualCompetitors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Competitors to Link ({manualCompetitors.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {manualCompetitors.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-1.5"
                      >
                        <span className="text-xs font-semibold text-text-primary">{c.name}</span>
                        {c.tracked && (
                          <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[9px] text-brand uppercase font-bold">
                            In Library
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveManualCompetitor(c.name)}
                          className="text-text-muted hover:text-negative transition-colors text-sm px-0.5 font-bold"
                          title="Remove competitor"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Tracked Brands Quick-Add */}
              {availableBrands.length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Or select from tracked brands in your library:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableBrands.map((b) => {
                      const isAdded = manualCompetitors.some(
                        (c) => c.name.toLowerCase() === b.name.toLowerCase()
                      );
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              handleRemoveManualCompetitor(b.name);
                            } else {
                              handleAddManualCompetitor(b.name);
                            }
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                            isAdded
                              ? "border-brand bg-brand/15 text-brand font-semibold"
                              : "border-border bg-ink text-text-muted hover:border-brand/40 hover:text-text-primary"
                          }`}
                        >
                          <span>{isAdded ? "✓" : "+"}</span>
                          <span>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-negative/30 bg-negative/10 p-4 text-xs font-medium text-negative">
            ⚠️ {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-border px-5 py-2.5 text-xs font-semibold text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || !brandName.trim()}
            className="rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating & Analyzing..." : "Create Brand & View Comparison →"}
          </button>
        </div>
      </form>
    </div>
  );
}