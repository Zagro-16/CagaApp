// localStorage robusto: evita crash con JSON sporco o storage pieno.

export function safeJsonParse(raw, fallback) {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // quota exceeded / disabled storage
    return false;
  }
}

export function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

export function ensureObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function uid(prefix = "id") {
  // ID stabile e leggibile, senza dipendenze.
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
