// ============================================================
// RivalLens API Service
// ============================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";


// ============================================================
// GENERIC REQUEST HELPER
// ============================================================

async function apiRequest(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(
      typeof message === "string"
        ? message
        : JSON.stringify(message)
    );
  }

  return data;
}


// ============================================================
// HEALTH
// ============================================================

export async function checkHealth() {
  return apiRequest("/api/health");
}


// ============================================================
// BRANDS
// ============================================================

export async function getBrands() {
  return apiRequest("/api/brands");
}


export async function getBrand(
  brandId
) {
  if (!brandId) {
    throw new Error("Brand ID is required.");
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(brandId)}`
  );
}


export async function createBrand(
  brandData
) {
  return apiRequest(
    "/api/brands",
    {
      method: "POST",
      body: JSON.stringify(
        brandData
      ),
    }
  );
}


// Alias used by some frontend components.
export const addBrand = createBrand;


// ============================================================
// UPDATE BRAND
// ============================================================

export async function updateBrand(
  brandId,
  brandData
) {
  if (!brandId) {
    throw new Error("Brand ID is required.");
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(brandId)}`,
    {
      method: "PUT",
      body: JSON.stringify(
        brandData
      ),
    }
  );
}


// ============================================================
// DELETE BRAND
// ============================================================

export async function deleteBrand(
  brandId
) {
  if (!brandId) {
    throw new Error("Brand ID is required.");
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(brandId)}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// COMPETITORS
// ============================================================

/*
 * Add an existing brand as a competitor.
 *
 * Backend:
 *
 * POST /api/brands/{brandId}/competitors/{competitorId}
 */

export async function addCompetitor(
  brandId,
  competitorId
) {
  if (!brandId) {
    throw new Error(
      "Active brand ID is required."
    );
  }

  if (!competitorId) {
    throw new Error(
      "Competitor ID is required."
    );
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(
      brandId
    )}/competitors/${encodeURIComponent(
      competitorId
    )}`,
    {
      method: "POST",
    }
  );
}


/*
 * Remove an existing competitor.
 *
 * Backend:
 *
 * DELETE /api/brands/{brandId}/competitors/{competitorId}
 */

export async function removeCompetitor(
  brandId,
  competitorId
) {
  if (!brandId) {
    throw new Error(
      "Active brand ID is required."
    );
  }

  if (!competitorId) {
    throw new Error(
      "Competitor ID is required."
    );
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(
      brandId
    )}/competitors/${encodeURIComponent(
      competitorId
    )}`,
    {
      method: "DELETE",
    }
  );
}


/*
 * Get saved competitors for an active brand.
 *
 * Backend:
 *
 * GET /api/comparison/active/{brandId}/competitors
 */

export async function getCompetitors(
  brandId
) {
  if (!brandId) {
    throw new Error(
      "Brand ID is required."
    );
  }

  return apiRequest(
    `/api/comparison/active/${encodeURIComponent(
      brandId
    )}/competitors`
  );
}


// Alias for compatibility.
export const getSavedCompetitors =
  getCompetitors;


// ============================================================
// AUTO-SUGGEST COMPETITORS
// ============================================================

/*
 * Automatically suggest 2 or 3 competitors.
 *
 * Backend:
 *
 * GET /api/comparison/active/{brandId}/suggest?count=2
 *
 * count must be 2 or 3.
 */

export async function getCompetitorSuggestions(
  brandName,
  category = "",
  count = 2
) {
  if (!brandName) {
    throw new Error("Brand name is required.");
  }

  const params = new URLSearchParams();
  params.set("name", brandName.trim());
  if (category) {
    params.set("category", category.trim());
  }
  params.set("count", String(count || 2));

  return apiRequest(`/api/brands/suggestions?${params.toString()}`);
}

export async function getBrandSuggestions(arg1, arg2, arg3) {
  if (typeof arg1 === "object" && arg1 !== null) {
    return getCompetitorSuggestions(
      arg1.name || arg1.brandName,
      arg1.category || "",
      arg1.count || 2
    );
  }
  return getCompetitorSuggestions(arg1, arg2, arg3);
}

export const getBrandCompetitorSuggestions = getCompetitorSuggestions;

export async function suggestCompetitors(
  brandId,
  count = 2
) {
  if (!brandId) {
    throw new Error(
      "Brand ID is required."
    );
  }

  if (
    count !== 2 &&
    count !== 3
  ) {
    throw new Error(
      "Competitor count must be 2 or 3."
    );
  }

  return apiRequest(
    `/api/comparison/active/${encodeURIComponent(
      brandId
    )}/suggest?count=${count}`
  );
}


// ============================================================
// COMPARISON
// ============================================================

/*
 * Compare explicitly selected brands.
 *
 * Example:
 *
 * getComparison([
 *   "brand-123",
 *   "brand-456",
 *   "brand-789"
 * ])
 *
 * This NEVER loads all brands automatically.
 */

export async function getComparison(
  brandIds = []
) {
  const ids = Array.isArray(
    brandIds
  )
    ? brandIds.filter(Boolean)
    : [];

  if (ids.length === 0) {
    return {
      brands: [],
      sentimentLeader: null,
      volumeLeader: null,
    };
  }

  const params =
    new URLSearchParams();

  params.set(
    "brand_ids",
    ids.join(",")
  );

  return apiRequest(
    `/api/comparison?${params.toString()}`
  );
}

export const compareBrands = getComparison;


// ============================================================
// ACTIVE BRAND + SAVED COMPETITORS
// ============================================================

/*
 * Compare:
 *
 * Active Brand
 *      +
 * Saved Competitors
 *
 * Other tracked brands are NOT included.
 */

export async function getActiveBrandComparison(
  brandId
) {
  if (!brandId) {
    throw new Error(
      "Active brand ID is required."
    );
  }

  return apiRequest(
    `/api/comparison/active/${encodeURIComponent(
      brandId
    )}`
  );
}


// ============================================================
// ACTIVE BRAND + AUTO-SUGGESTED COMPETITORS
// ============================================================

export async function getSuggestedComparison(
  brandId,
  count = 2
) {
  return suggestCompetitors(
    brandId,
    count
  );
}


// ============================================================
// BRAND SUMMARY
// ============================================================

export async function getBrandSummary(
  brandId
) {
  if (!brandId) {
    throw new Error(
      "Brand ID is required."
    );
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(
      brandId
    )}/summary`
  );
}


// ============================================================
// TREND
// ============================================================

export async function getBrandTrend(
  brandId,
  days = null
) {
  if (!brandId) {
    throw new Error(
      "Brand ID is required."
    );
  }

  let endpoint =
    `/api/brands/${encodeURIComponent(
      brandId
    )}/trend`;

  if (
    days !== null &&
    days !== undefined
  ) {
    endpoint += `?days=${encodeURIComponent(
      days
    )}`;
  }

  return apiRequest(
    endpoint
  );
}


// Alias
export const getTrend =
  getBrandTrend;


// ============================================================
// ASPECTS
// ============================================================

export async function getBrandAspects(
  brandId
) {
  if (!brandId) {
    throw new Error(
      "Brand ID is required."
    );
  }

  return apiRequest(
    `/api/brands/${encodeURIComponent(
      brandId
    )}/aspects`
  );
}


// Alias
export const getAspects =
  getBrandAspects;


// ============================================================
// RECENT MENTIONS
// ============================================================

export async function getRecentMentions(
  brandId,
  options = {}
) {
  if (!brandId) {
    throw new Error(
      "Brand ID is required."
    );
  }

  const params =
    new URLSearchParams();

  if (options.limit) {
    params.set(
      "limit",
      options.limit
    );
  }

  if (options.sentiment) {
    params.set(
      "sentiment",
      options.sentiment
    );
  }

  if (options.source) {
    params.set(
      "source",
      options.source
    );
  }

  if (options.status) {
    params.set(
      "status",
      options.status
    );
  }

  if (options.language) {
    params.set(
      "language",
      options.language
    );
  }

  if (options.duplicates) {
    params.set(
      "duplicates",
      options.duplicates
    );
  }

  const query =
    params.toString();

  const endpoint =
    `/api/brands/${encodeURIComponent(
      brandId
    )}/mentions${
      query
        ? `?${query}`
        : ""
    }`;

  return apiRequest(
    endpoint
  );
}


export async function getAllMentions(options = {}) {
  const params = new URLSearchParams();
  if (options.brandId) params.set("brand_id", options.brandId);
  if (options.sentiment) params.set("sentiment", options.sentiment);
  if (options.source) params.set("source", options.source);
  if (options.status) params.set("status", options.status);
  if (options.language) params.set("language", options.language);
  if (options.duplicates) params.set("duplicates", options.duplicates);
  if (options.q) params.set("q", options.q);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));

  const query = params.toString();
  return apiRequest(`/api/mentions${query ? `?${query}` : ""}`);
}

export async function addMention(payload) {
  return apiRequest("/api/mentions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteMention(mentionId) {
  if (!mentionId) throw new Error("Mention ID is required.");
  return apiRequest(`/api/mentions/${encodeURIComponent(mentionId)}`, {
    method: "DELETE",
  });
}

export async function getReviewQualityStats(brandId = null) {
  const params = new URLSearchParams();
  if (brandId) params.set("brand_id", brandId);
  const query = params.toString();
  return apiRequest(`/api/mentions/quality-stats${query ? `?${query}` : ""}`);
}

export async function getQualityReviews(options = {}) {
  const params = new URLSearchParams();
  if (options.brandId) params.set("brand_id", options.brandId);
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiRequest(`/api/reviews/quality${query ? `?${query}` : ""}`);
}

export async function getDuplicateReviews(options = {}) {
  const params = new URLSearchParams();
  if (options.brandId) params.set("brand_id", options.brandId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiRequest(`/api/reviews/duplicates${query ? `?${query}` : ""}`);
}

export async function getSpamReviews(options = {}) {
  const params = new URLSearchParams();
  if (options.brandId) params.set("brand_id", options.brandId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return apiRequest(`/api/reviews/spam${query ? `?${query}` : ""}`);
}

export async function getLanguageDistribution(brandId = null) {
  const params = new URLSearchParams();
  if (brandId) params.set("brand_id", brandId);
  const query = params.toString();
  return apiRequest(`/api/reviews/languages${query ? `?${query}` : ""}`);
}

export async function triggerIngest(brandId) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/ingest`, {
    method: "POST",
  });
}

export const triggerIngestion = triggerIngest;
export const getBrandMentions = getRecentMentions;
export const getMentions = getRecentMentions;

export async function getAnalytics(options = {}) {
  const params = new URLSearchParams();
  if (options.brandId) params.set("brand_id", options.brandId);
  if (options.days) params.set("days", String(options.days));

  const query = params.toString();
  return apiRequest(`/api/analytics${query ? `?${query}` : ""}`);
}

export async function getAiRecommendations(brandId) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/ai-recommendations`);
}

export const getAiInsights = getAiRecommendations;

export async function getCrisisAnalysis(brandId) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/crisis`);
}

export async function getRootCauseAnalysis(brandId) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/root-cause`);
}

export async function getSentimentForecast(brandId, days = 7) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/forecast?days=${days}`);
}

export async function getCompetitiveInsights(brandId, competitorIds = null) {
  if (!brandId) throw new Error("Brand ID is required.");
  const ids = Array.isArray(competitorIds)
    ? competitorIds.filter(Boolean).join(",")
    : competitorIds || "";
  const query = ids ? `?competitor_ids=${encodeURIComponent(ids)}` : "";
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/competitive-insights${query}`);
}

export async function getViralComplaints(brandId, limit = 10) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/viral-complaints?limit=${limit}`);
}

export async function getBrandHealthScore(brandId) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/health-score`);
}

export async function askRivalLens(brandId, question) {
  if (!brandId) throw new Error("Brand ID is required.");
  return apiRequest(`/api/brands/${encodeURIComponent(brandId)}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// ============================================================
// DEFAULT API OBJECT
// ============================================================

const api = {
  checkHealth,

  getBrands,
  getBrand,
  createBrand,
  addBrand,
  updateBrand,
  deleteBrand,

  addCompetitor,
  removeCompetitor,
  getCompetitors,
  getSavedCompetitors,

  getCompetitorSuggestions,
  getBrandSuggestions,
  getBrandCompetitorSuggestions,
  suggestCompetitors,

  getComparison,
  compareBrands,
  getActiveBrandComparison,
  getSuggestedComparison,

  getBrandSummary,
  getBrandTrend,
  getTrend,

  getBrandAspects,
  getAspects,

  getRecentMentions,
  getMentions,
  getBrandMentions,
  getAllMentions,
  addMention,
  deleteMention,
  getReviewQualityStats,
  getQualityReviews,
  getDuplicateReviews,
  getSpamReviews,
  getLanguageDistribution,
  triggerIngest,
  triggerIngestion,
  getAnalytics,
  getAiRecommendations,
  getAiInsights,
  getCrisisAnalysis,
  getRootCauseAnalysis,
  getSentimentForecast,
  getCompetitiveInsights,
  getViralComplaints,
  getBrandHealthScore,
  askRivalLens,
};

export default api;