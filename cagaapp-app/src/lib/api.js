// cagaapp-app/src/lib/api.js
import { ensureArray } from "./safeStorage.js";

const DEV = import.meta.env.DEV;

async function safeFetchJSON(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} su ${url}${text ? ` — ${text.slice(0, 120)}` : ""}`);
  }

  return res.json().catch(() => ({}));
}

/* =========================
   PLACES
   ========================= */

export async function fetchPublicPlaces() {
  if (DEV) return [];
  const data = await safeFetchJSON("/api/places-get");
  return ensureArray(data?.items);
}

export async function addPublicPlace(payload) {
  if (DEV) return { ok: true, id: `dev_${Date.now()}` };

  return safeFetchJSON("/api/places-add", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
}

export async function deletePublicPlace(id) {
  if (DEV) return { ok: true };

  return safeFetchJSON("/api/places-delete", {
    method: "POST",
    body: JSON.stringify({ id }),
    headers: { "Content-Type": "application/json" }
  });
}

/* =========================
   REVIEWS (CLOUD)
   ========================= */

export async function fetchCloudReviews(placeId) {
  if (DEV) return [];
  if (!placeId) return [];

  const data = await safeFetchJSON(`/api/reviews-get?placeId=${encodeURIComponent(placeId)}`);
  return ensureArray(data?.items);
}

export async function addCloudReview(review) {
  if (DEV) return { ok: true };

  return safeFetchJSON("/api/reviews-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review)
  });
}
