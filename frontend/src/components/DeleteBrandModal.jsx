import { useState } from "react";

export default function DeleteBrandModal({ brand, isOpen, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !brand) return null;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm(brand.id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete brand");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-negative/10 text-negative text-lg font-bold">
            ⚠️
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">Delete Brand</h2>
            <p className="text-xs text-text-muted">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-text-muted leading-relaxed">
          Are you sure you want to delete <strong className="text-text-primary">{brand.name}</strong>?
          All associated mentions ({brand.mentionCount || 0}) and sentiment trends will be permanently removed.
        </p>

        {error && <p className="mt-3 text-xs text-negative">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-hover hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-negative px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}