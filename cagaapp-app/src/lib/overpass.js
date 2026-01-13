// src/lib/overpass.js
// Overpass: toilets + "likely" (bar/cafe/etc).
// PRO: query compatta, retry su 504/429, fallback "toilets only", endpoint multipli.

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
  const name = safeStr(tags.name) || "Bagno";
  const id = `osm:${el.type}/${el.id}`;

  return {
    source: "osm",
    id,
    kind: "toilet",
    category: "Bagno confermato",
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

function parseLikely(el, label) {
  const center = pickCenter(el);
  if (!center) return null;

  const tags = normalizeTags(el.tags);
  const name = safeStr(tags.name) || label;
  const id = `osm:${el.type}/${el.id}:likely`;

  return {
    source: "osm",
    id,
    kind: "likely",
    category: label,
    name,
    lat: center.lat,
    lon: center.lon,
    meta: {
      opening: safeStr(tags.opening_hours),
      fee: "",
      access: "",
      unisex: "",
      wheelchair: safeStr(tags.wheelchair),
      notes: "Bagno probabile (luogo correlato).",
      address: safeStr(tags["addr:full"]) || safeStr(tags["addr:street"]) || ""
    }
  };
}

function labelFromTags(tags) {
  if (tags?.amenity === "bar") return "Bar";
  if (tags?.amenity === "pub") return "Pub";
  if (tags?.amenity === "cafe") return "Caffè";
  if (tags?.amenity === "restaurant") return "Ristorante";
  if (tags?.amenity === "fast_food") return "Fast food";
  if (tags?.railway === "station") return "Stazione";
  if (tags?.amenity === "bus_station") return "Bus station";
  if (tags?.aeroway === "terminal") return "Aeroporto";
  if (tags?.shop === "mall") return "Centro commerciale";
  if (tags?.shop === "supermarket") return "Supermercato";
  return "";
}

function buildQuery({ lat, lon, radiusMeters, includeLikely, timeoutSec }) {
  const R = clamp(radiusMeters, MIN, MAX);

  // ✅ compatta: nwr + regex
  const likely = includeLikely
    ? `
      nwr(around:${R},${lat},${lon})["amenity"~"^(bar|pub|cafe|restaurant|fast_food|bus_station)$"];
      nwr(around:${R},${lat},${lon})["railway"="station"];
      nwr(around:${R},${lat},${lon})["aeroway"="terminal"];
      nwr(around:${R},${lat},${lon})["shop"~"^(mall|supermarket)$"];
    `
    : "";

  return `
    [out:json][timeout:${timeoutSec}];
    (
      nwr(around:${R},${lat},${lon})["amenity"="toilets"];
      ${likely}
    );
    out center tags qt;
  `;
}

function buildToiletsOnlyQuery({ lat, lon, radiusMeters, timeoutSec }) {
  const R = clamp(radiusMeters, MIN, MAX);
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
  // extra-safety client side (non sostituisce il timeout overpass)
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

function parseElements(elements, includeLikely) {
  const out = [];
  const arr = Array.isArray(elements) ? elements : [];

  for (const el of arr) {
    const tags = normalizeTags(el?.tags);

    if (tags?.amenity === "toilets") {
      const it = parseToilet(el);
      if (it) out.push(it);
      continue;
    }

    if (includeLikely) {
      const label = labelFromTags(tags);
      if (label) {
        const it = parseLikely(el, label);
        if (it) out.push(it);
      }
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
 * - 1° giro: query completa (toilets + likely) con timeout 35
 * - se 504/429: retry con timeout 45 e piccola attesa
 * - se fallisce ancora: fallback "toilets only" (sempre con retry)
 */
export async function searchToilets({
  lat,
  lon,
  radiusMeters,
  includeLikely = true,
  maxResults = 300
}) {
  const la = toNumber(lat);
  const lo = toNumber(lon);
  if (la == null || lo == null) throw new Error("Coordinate non valide.");

  const R = clamp(radiusMeters, MIN, MAX);
  const limit = Math.max(50, Math.min(800, Number(maxResults) || 300));

  // 2 tentativi per query completa, poi fallback
  const attempts = [
    { kind: "full", timeoutSec: 35, waitMs: 0 },
    { kind: "full", timeoutSec: 45, waitMs: 650 }
  ];

  const fallbackAttempts = [
    { kind: "toiletsOnly", timeoutSec: 35, waitMs: 350 },
    { kind: "toiletsOnly", timeoutSec: 45, waitMs: 650 }
  ];

  let lastErr = null;

  // helper che prova su tutti gli endpoint
  async function tryAllEndpoints(query, incLikely) {
    for (let i = 0; i < ENDPOINTS.length; i++) {
      try {
        const json = await postOverpass(ENDPOINTS[i], query);
        const parsed = parseElements(json?.elements, incLikely);
        return parsed.slice(0, limit);
      } catch (e) {
        lastErr = e;

        const s = Number(e?.status || 0);
        // se endpoint è carico, prova subito il prossimo
        // (wait gestita fuori)
        if (s === 400) {
          // 400 = query respinta, inutile insistere troppo su quell'endpoint
        }
      }
    }
    return null;
  }

  // --- full query ---
  for (const a of attempts) {
    if (a.waitMs) await sleep(a.waitMs);

    const query = buildQuery({
      lat: la,
      lon: lo,
      radiusMeters: R,
      includeLikely,
      timeoutSec: a.timeoutSec
    });

    const data = await tryAllEndpoints(query, includeLikely);

    if (data && data.length) return data;

    // se errore non è 504/429, passa direttamente al fallback (eviti attese inutili)
    const s = Number(lastErr?.status || 0);
    if (s && s !== 504 && s !== 429 && s !== 0) break;
  }

  // --- toilets only fallback ---
  for (const a of fallbackAttempts) {
    if (a.waitMs) await sleep(a.waitMs);

    const query = buildToiletsOnlyQuery({
      lat: la,
      lon: lo,
      radiusMeters: R,
      timeoutSec: a.timeoutSec
    });

    const data = await tryAllEndpoints(query, false);
    if (data && data.length) return data;

    const s = Number(lastErr?.status || 0);
    if (s && s !== 504 && s !== 429 && s !== 0) break;
  }

  throw new Error(lastErr?.message || "Overpass non disponibile. Riprova tra poco.");
}
