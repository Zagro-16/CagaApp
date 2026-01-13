// cagaapp-app/src/lib/api.js
import { ensureArray } from "./safeStorage.js";

const DEV = import.meta.env.DEV;

// Piccola fetch robusta
async function safeFetchJSON(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} su ${url}${text ? ` — ${text.slice(0, 120)}` : ""}`);
  }

  const data = await res.json().catch(() => ({}));
  return data;
}

export async function fetchPublicPlaces() {
  // ✅ In DEV evita 404 (Netlify functions non girano su vite dev)
  if (DEV) return [];

  const data = await safeFetchJSON("/api/places-get");
  return ensureArray(data?.items);
}

export async function addPublicPlace(payload) {
  if (DEV) {
    // In dev non facciamo chiamate, ma non rompiamo la UI
    return { ok: true, id: `dev_${Date.now()}` };
  }

  const data = await safeFetchJSON("/api/places-add", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });

  return data;
}

export async function deletePublicPlace(id) {
  if (DEV) return { ok: true };

  const data = await safeFetchJSON("/api/places-delete", {
    method: "POST",
    body: JSON.stringify({ id }),
    headers: { "Content-Type": "application/json" }
  });

  return data;
}
