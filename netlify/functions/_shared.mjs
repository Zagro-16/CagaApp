import { getStore } from "@netlify/blobs";

const STORE_NAME = "cagaapp";
const KEY = "public_places_v1";

export function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export function badRequest(message) {
  return json({ ok: false, error: message }, 400);
}

export async function getPlacesStore() {
  // Netlify Blobs: store per sito
  return getStore(STORE_NAME);
}

export async function readPlaces() {
  const store = await getPlacesStore();
  const data = await store.get(KEY, { type: "json" });
  if (!data || !Array.isArray(data.items)) return { items: [] };
  return { items: data.items };
}

export async function writePlaces(items) {
  const store = await getPlacesStore();
  const safeItems = Array.isArray(items) ? items : [];
  await store.setJSON(KEY, { items: safeItems });
}
