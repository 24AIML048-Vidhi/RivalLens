import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DeleteBrandModal from "../components/DeleteBrandModal";

export default function Brands({ brands = [], activeBrandId, onSelectBrand, onDeleteBrand, onRefreshBrands }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrandForDelete, setSelectedBrandForDelete] = useState(null);
  const navigate = useNavigate();

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.category && b.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  function handleSelectAndNavigate(brandId) {
    if (onSelectBrand) onSelectBrand(brandId);
    navigate("/");
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Brand Management</h1>
          <p className="text-sm text-text-muted">
            Monitor and manage all competitor brands tracked by RivalLens.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search brands or categories…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none"
          />
          <Link
            to="/add-brand"
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            + Add New Brand
          </Link>
        </div>
      </div>

      {/* Brands Grid / Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredBrands.map((brand) => {
          const isActive = brand.id === activeBrandId;
          const score = brand.sentimentScore || 50;
          const scoreColor =
            score >= 58 ? "text-positive" : score <= 42 ? "text-negative" : "text-neutral";

          return (
            <div
              key={brand.id}
              className={`flex flex-col justify-between rounded-xl border p-5 shadow-card transition-all ${
                isActive
                  ? "border-brand bg-surface ring-1 ring-brand/30"
                  : "border-border bg-surface hover:border-text-muted/40"
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">{brand.name}</h2>
                    <span className="rounded bg-ink px-2 py-0.5 text-xs text-text-muted border border-border">
                      {brand.category || "General"}
                    </span>
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand-hover">
                      Active
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border/50 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-text-muted">Mentions</p>
                    <p className="font-mono text-lg font-bold text-text-primary">
                      {(brand.mentionCount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-text-muted">Sentiment</p>
                    <p className={`font-mono text-lg font-bold ${scoreColor}`}>
                      {score} <span className="text-xs text-text-muted font-normal">/ 100</span>
                    </p>
                  </div>
                </div>

                {/* Competitors List */}
                <div className="mt-3">
                  <p className="text-[11px] text-text-muted">Competitors linked:</p>
                  <p className="text-xs text-text-primary font-medium mt-0.5 truncate">
                    {brand.competitorNames?.length > 0
                      ? brand.competitorNames.join(", ")
                      : "None"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3">
                <button
                  onClick={() => handleSelectAndNavigate(brand.id)}
                  className="text-xs font-semibold text-brand-hover hover:underline"
                >
                  View Dashboard →
                </button>

                <button
                  onClick={() => setSelectedBrandForDelete(brand)}
                  className="rounded px-2 py-1 text-xs text-text-muted hover:bg-negative/10 hover:text-negative transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredBrands.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center">
          <span className="text-3xl">🔍</span>
          <p className="mt-2 font-medium text-text-primary">No brands matched "{searchTerm}"</p>
          <p className="text-xs text-text-muted mt-1">Try a different search query or track a new brand.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteBrandModal
        brand={selectedBrandForDelete}
        isOpen={Boolean(selectedBrandForDelete)}
        onClose={() => setSelectedBrandForDelete(null)}
        onConfirm={async (brandId) => {
          await onDeleteBrand(brandId);
          setSelectedBrandForDelete(null);
        }}
      />
    </div>
  );
}