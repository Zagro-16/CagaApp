// src/lib/overpass.js
// Overpass: SOLO bagni pubblici (amenity=toilets).
// PRO: query compatta, retry su 504/429, endpoint multipli, parsing robusto.
// Nota: niente "likely" (bar/cafe/etc). Solo risultati confermati.

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter"
];

const MIN = 50;
const MAX = 5000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeTags(tags) {
  return tags && typeof tags === "object" ? tags : {};
}

function pickCenter(el) {
  const lat = toNumber(el?.lat ?? el?.center?.lat);
  const lon = toNumber(el?.lon ?? el?.center?.lon);
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

function parseToilet(el) {
  const center = pickCenter(el);
  if (!center) return null;

  const tags = normalizeTags(el.tags);
  const name = safeStr(tags.name) || "Bagno pubblico";
  const id = `osm:${el.type}/${el.id}`;

  return {
    source: "osm",
    id,
    kind: "toilet",
    category: "Bagno pubblico",
    name,
    lat: center.lat,
    lon: center.lon,
    meta: {
      opening: safeStr(tags.opening_hours),
      fee: safeStr(tags.fee),
      access: safeStr(tags.access),
      unisex: safeStr(tags.unisex),
      wheelchair: safeStr(tags.wheelchair),
      notes: "",
      address: safeStr(tags["addr:full"]) || safeStr(tags["addr:street"]) || ""
    }
  };
}

function buildToiletsQuery({ lat, lon, radiusMeters, timeoutSec }) {
  const R = clamp(radiusMeters, MIN, MAX);

  // ✅ compatta: nwr (node/way/relation) -> toilets only
  return `
    [out:json][timeout:${timeoutSec}];
    (
      nwr(around:${R},${lat},${lon})["amenity"="toilets"];
    );
    out center tags qt;
  `;
}

async function postOverpass(endpoint, query) {
  const controller = new AbortController();
  const hardTimeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json"
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const msg = txt ? txt.slice(0, 220) : `HTTP ${res.status}`;
      const err = new Error(`Overpass ${res.status}: ${msg}`);
      err.status = res.status;
      throw err;
    }

    return res.json();
  } finally {
    clearTimeout(hardTimeout);
  }
}

function parseElements(elements) {
  const out = [];
  const arr = Array.isArray(elements) ? elements : [];

  for (const el of arr) {
    const tags = normalizeTags(el?.tags);

    if (tags?.amenity === "toilets") {
      const it = parseToilet(el);
      if (it) out.push(it);
    }
  }

  // dedupe
  const map = new Map();
  for (const it of out) {
    if (it?.id && !map.has(it.id)) map.set(it.id, it);
  }
  return Array.from(map.values());
}

/**
 * Strategia:
 * - 2 tentativi con timeout progressivo (35 -> 45) e piccola attesa
 * - prova endpoint multipli
 * - se errore non è 504/429, evita attese inutili
 */
export async function searchToilets({
  lat,
  lon,
  radiusMeters,
  maxResults = 300
}) {
  const la = toNumber(lat);
  const lo = toNumber(lon);
  if (la == null || lo == null) throw new Error("Coordinate non valide.");

  const R = clamp(radiusMeters, MIN, MAX);
  const limit = Math.max(50, Math.min(800, Number(maxResults) || 300));

  const attempts = [
    { timeoutSec: 35, waitMs: 0 },
    { timeoutSec: 45, waitMs: 650 }
  ];

  let lastErr = null;

  async function tryAllEndpoints(query) {
    for (let i = 0; i < ENDPOINTS.length; i++) {
      try {
        const json = await postOverpass(ENDPOINTS[i], query);
        const parsed = parseElements(json?.elements);
        return parsed.slice(0, limit);
      } catch (e) {
        lastErr = e;
        // prova endpoint successivo
      }
    }
    return null;
  }

  for (const a of attempts) {
    if (a.waitMs) await sleep(a.waitMs);

    const query = buildToiletsQuery({
      lat: la,
      lon: lo,
      radiusMeters: R,
      timeoutSec: a.timeoutSec
    });

    const data = await tryAllEndpoints(query);
    if (data && data.length) return data;

    // se non è 504/429, non perdere tempo in retry
    const s = Number(lastErr?.status || 0);
    if (s && s !== 504 && s !== 429 && s !== 0) break;
  }

  throw new Error(lastErr?.message || "Overpass non disponibile. Riprova tra poco.");
}
