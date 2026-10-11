import { useCallback, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AddMentionModal from "./components/AddMentionModal";

import Dashboard from "./pages/Dashboard";
import Brands from "./pages/Brands";
import AddBrand from "./pages/AddBrand";
import Analytics from "./pages/Analytics";
import Mentions from "./pages/Mentions";
import Comparison from "./pages/Comparison";
import Settings from "./pages/Settings";

import {
  getBrands,
  deleteBrand,
  checkHealth,
} from "./services/api";

export default function App() {
  const [brands, setBrands] = useState([]);
  const [activeBrandId, setActiveBrandId] = useState(null);
  const [apiOnline, setApiOnline] = useState(true);
  const [isAddMentionOpen, setIsAddMentionOpen] = useState(false);

  /*
   * ============================================================
   * LOAD BRANDS
   * ============================================================
   *
   * Gets all tracked brands from the FastAPI backend.
   */
  const refreshBrands = useCallback(async () => {
    try {
      const data = await getBrands();

      const normalizedBrands = Array.isArray(data) ? data : [];

      setBrands(normalizedBrands);
      setApiOnline(true);

      return normalizedBrands;
    } catch (err) {
      console.error("Failed to load brands from API:", err);

      setApiOnline(false);

      return [];
    }
  }, []);

  /*
   * ============================================================
   * INITIAL APP LOAD
   * ============================================================
   */
  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        await checkHealth();

        if (mounted) {
          setApiOnline(true);
        }
      } catch (err) {
        console.error("Backend health check failed:", err);

        if (mounted) {
          setApiOnline(false);
        }
      }

      const loadedBrands = await refreshBrands();

      if (!mounted) {
        return;
      }

      if (loadedBrands.length > 0) {
        setActiveBrandId((currentId) => {
          /*
           * Keep the current active brand if it still exists.
           */
          const currentStillExists = loadedBrands.some(
            (brand) => brand.id === currentId
          );

          if (currentStillExists) {
            return currentId;
          }

          /*
           * Otherwise automatically select the first tracked brand.
           */
          return loadedBrands[0].id;
        });
      } else {
        setActiveBrandId(null);
      }
    }

    initializeApp();

    return () => {
      mounted = false;
    };
  }, [refreshBrands]);

  /*
   * ============================================================
   * ACTIVE BRAND
   * ============================================================
   *
   * The active brand is important for the new comparison system.
   *
   * Comparison should now be:
   *
   *     Active Brand
   *          |
   *          +---- Competitor 1
   *          +---- Competitor 2
   *          +---- Competitor 3
   *
   * It should NOT automatically compare against every tracked
   * brand in the database.
   */
  const activeBrand =
    brands.find((brand) => brand.id === activeBrandId) ??
    brands[0] ??
    null;

  /*
   * ============================================================
   * CHANGE ACTIVE BRAND
   * ============================================================
   */
  function handleChangeActiveBrand(brandId) {
    setActiveBrandId(brandId);
  }

  /*
   * ============================================================
   * BRAND ADDED
   * ============================================================
   *
   * Called by AddBrand.jsx after successfully creating a brand.
   */
  function handleBrandAdded(newBrand) {
    if (!newBrand) {
      return;
    }

    setBrands((previousBrands) => {
      /*
       * Prevent duplicate brands from appearing in the UI.
       */
      const alreadyExists = previousBrands.some(
        (brand) => brand.id === newBrand.id
      );

      if (alreadyExists) {
        return previousBrands.map((brand) =>
          brand.id === newBrand.id ? newBrand : brand
        );
      }

      return [newBrand, ...previousBrands];
    });

    /*
     * Newly created brand becomes the active brand.
     */
    setActiveBrandId(newBrand.id);
  }

  /*
   * ============================================================
   * DELETE BRAND
   * ============================================================
   */
  async function handleDeleteBrand(brandId) {
    if (!brandId) {
      return;
    }

    try {
      await deleteBrand(brandId);

      setBrands((previousBrands) => {
        const remainingBrands = previousBrands.filter(
          (brand) => brand.id !== brandId
        );

        /*
         * If the deleted brand was active, select another brand.
         */
        if (activeBrandId === brandId) {
          setActiveBrandId(
            remainingBrands.length > 0
              ? remainingBrands[0].id
              : null
          );
        }

        return remainingBrands;
      });
    } catch (err) {
      console.error("Failed to delete brand:", err);

      alert(
        "Failed to delete brand: " +
          (err?.message || "Unknown error")
      );
    }
  }

  /*
   * ============================================================
   * REFRESH AFTER MENTION
   * ============================================================
   */
  async function handleMentionAdded() {
    await refreshBrands();
  }

  return (
    <div className="flex h-screen bg-ink text-text-primary overflow-hidden font-body">
      {/* ======================================================
          SIDEBAR
          ====================================================== */}
      <Sidebar />

      {/* ======================================================
          MAIN CONTENT
          ====================================================== */}
      <div className="flex flex-1 flex-col overflow-y-auto">

        {/* ====================================================
            TOPBAR
            ==================================================== */}
        <Topbar
          brands={brands}
          activeBrandId={activeBrandId}
          onChangeBrand={handleChangeActiveBrand}
          onOpenAddMention={() => setIsAddMentionOpen(true)}
          apiOnline={apiOnline}
        />

        {/* ====================================================
            PAGE ROUTES
            ==================================================== */}
        <main className="flex-1 pb-12">
          <Routes>

            {/* ==================================================
                DASHBOARD
                ================================================== */}
            <Route
              path="/"
              element={
                <Dashboard
                  activeBrand={activeBrand}
                  onRefreshBrands={refreshBrands}
                  onOpenAddMention={() =>
                    setIsAddMentionOpen(true)
                  }
                />
              }
            />

            {/* ==================================================
                BRANDS
                ================================================== */}
            <Route
              path="/brands"
              element={
                <Brands
                  brands={brands}
                  activeBrandId={activeBrandId}
                  onSelectBrand={handleChangeActiveBrand}
                  onDeleteBrand={handleDeleteBrand}
                  onRefreshBrands={refreshBrands}
                />
              }
            />

            {/* ==================================================
                ADD BRAND

                AddBrand now handles:

                1. Manual competitor selection
                2. Existing tracked competitor selection
                3. Auto-suggest 2 competitors
                4. Auto-suggest 3 competitors
                ================================================== */}
            <Route
              path="/add-brand"
              element={
                <AddBrand
                  brands={brands}
                  onBrandAdded={handleBrandAdded}
                  onRefreshBrands={refreshBrands}
                />
              }
            />

            {/* ==================================================
                ANALYTICS
                ================================================== */}
            <Route
              path="/analytics"
              element={
                <Analytics
                  brands={brands}
                  activeBrandId={activeBrandId}
                />
              }
            />

            {/* ==================================================
                MENTIONS
                ================================================== */}
            <Route
              path="/mentions"
              element={
                <Mentions
                  brands={brands}
                  activeBrandId={activeBrandId}
                  onOpenAddMention={() =>
                    setIsAddMentionOpen(true)
                  }
                />
              }
            />

            {/* ==================================================
                COMPARISON

                IMPORTANT:
                The Comparison page receives the active brand ID.

                It should compare ONLY:

                    active brand
                    +
                    its saved competitors

                It should NOT compare the active brand with
                every tracked brand.
                ================================================== */}
            <Route
              path="/comparison"
              element={
                <Comparison
                  brands={brands}
                  activeBrandId={activeBrandId}
                  activeBrand={activeBrand}
                  onRefreshBrands={refreshBrands}
                />
              }
            />

            {/* ==================================================
                SETTINGS
                ================================================== */}
            <Route
              path="/settings"
              element={<Settings />}
            />

          </Routes>
        </main>
      </div>

      {/* ======================================================
          ADD MENTION MODAL
          ====================================================== */}
      <AddMentionModal
        brands={brands}
        activeBrandId={activeBrandId}
        isOpen={isAddMentionOpen}
        onClose={() => setIsAddMentionOpen(false)}
        onMentionAdded={handleMentionAdded}
      />
    </div>
  );
}