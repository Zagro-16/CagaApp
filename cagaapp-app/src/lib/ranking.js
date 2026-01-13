// Ranking "MAX UTILE++"
// Aggiunge un punteggio di affidabilità/uso pratico basato su tag OSM.
// Non sostituisce la distanza: serve per ordinare meglio i risultati.

function norm(v) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function isYes(v) {
  const x = norm(v);
  return x === "yes" || x === "true" || x === "1";
}

function isNo(v) {
  const x = norm(v);
  return x === "no" || x === "false" || x === "0";
}

function hasText(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Calcola un punteggio >= 0
export function computeUtilityScore(item) {
  const tags = item?._tags || {};
  const meta = item?.meta || {};

  let score = 0;

  // 1) Bagni espliciti (massima affidabilità)
  if (norm(tags.amenity) === "toilets") score += 3.0;

  // 2) Accesso pubblico
  const access = norm(meta.access || tags.access);
  if (access === "public" || access === "yes") score += 1.2;
  if (access === "customers") score += 0.3; // utile ma può richiedere consumo
  if (access === "private" || access === "no") score -= 0.8;

  // 3) Gratis / a pagamento
  const fee = norm(meta.fee || tags.fee);
  if (isNo(fee)) score += 1.0;
  if (isYes(fee) || fee === "yes") score -= 0.4;

  // 4) Orari presenti
  if (hasText(meta.opening || tags.opening_hours)) score += 0.5;

  // 5) Accessibilità
  const wheelchair = norm(meta.wheelchair || tags.wheelchair || tags["toilets:wheelchair"]);
  if (wheelchair === "yes") score += 0.6;
  if (wheelchair === "no") score -= 0.2;

  // 6) Fasciatoio / unisex (bonus piccoli)
  if (isYes(meta.changing_table || tags.changing_table)) score += 0.25;
  if (isYes(meta.unisex || tags.unisex)) score += 0.15;

  // 7) Indirizzo presente (affidabilità)
  if (hasText(meta.address)) score += 0.25;

  // 8) Penalità leggerissima se nome è troppo generico
  const name = norm(item?.name);
  if (!name || name === "wc / bagno" || name === "bagni pubblici" || name === "wc / bagno") score -= 0.1;

  // clamp per sicurezza
  if (!Number.isFinite(score)) score = 0;
  return Math.max(0, Math.min(6, score));
}
