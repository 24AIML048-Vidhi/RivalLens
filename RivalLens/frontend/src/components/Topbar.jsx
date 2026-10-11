import { Link } from "react-router-dom";

export default function Topbar({
  brands = [],
  activeBrandId = null,
  onChangeBrand,
  onOpenAddMention,
  apiOnline = true,
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-ink px-6">
      {/* Brand Selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="brand-switch" className="text-sm font-medium text-text-muted">
          Active Brand:
        </label>
        <select
          id="brand-switch"
          value={activeBrandId ?? ""}
          onChange={(e) => onChangeBrand && onChangeBrand(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary focus:border-brand focus:outline-none"
        >
          {brands.length === 0 ? (
            <option value="">No brands available</option>
          ) : (
            brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.category ? `(${b.category})` : ""}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Action Buttons & Status */}
      <div className="flex items-center gap-3">
        {/* Backend Online Status */}
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-muted">
          <span
            className={`h-2 w-2 rounded-full ${
              apiOnline ? "bg-positive animate-pulse" : "bg-negative"
            }`}
          />
          <span>{apiOnline ? "API Online" : "Offline"}</span>
        </div>

        {/* Quick Add Mention Button */}
        {onOpenAddMention && (
          <button
            onClick={onOpenAddMention}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover hover:border-text-muted"
          >
            + Add Mention
          </button>
        )}

        {/* Add Brand Link */}
        <Link
          to="/add-brand"
          className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          + Track Brand
        </Link>
      </div>
    </header>
  );
}