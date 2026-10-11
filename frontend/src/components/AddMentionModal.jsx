import { useState } from "react";
import { addMention } from "../services/api";

export default function AddMentionModal({ brands = [], activeBrandId, isOpen, onClose, onMentionAdded }) {
  const [brandId, setBrandId] = useState(activeBrandId || (brands[0]?.id ?? ""));
  const [text, setText] = useState("");
  const [source, setSource] = useState("web");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Please enter mention text.");
      return;
    }
    if (!brandId) {
      setError("Please select a brand.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newMention = await addMention({
        brand_id: brandId,
        text: text.trim(),
        source: source,
        author: author.trim() || "User Review",
      });

      setText("");
      setAuthor("");
      if (onMentionAdded) onMentionAdded(newMention);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add mention");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Add Mention / Review</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Brand Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Target Brand</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.category ? `(${b.category})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Source Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Source Platform</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
            >
              <option value="web">Web Review / Forum</option>
              <option value="instagram">Instagram Post / Reel</option>
              <option value="youtube">YouTube Comment</option>
              <option value="manual">Manual Entry / Customer Feedback</option>
            </select>
          </div>

          {/* Author */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Author (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
            />
          </div>

          {/* Text content */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Mention Text</label>
            <textarea
              rows={3}
              placeholder="e.g. Zepto delivery was super fast today, arrived in 8 minutes!"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
            />
            <span className="text-[11px] text-text-muted">
              Sentiment and product aspect will be automatically classified.
            </span>
          </div>

          {error && <p className="text-xs text-negative">{error}</p>}

          {/* Submit */}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? "Analyzing & Saving…" : "Add Mention"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}