import { json, badRequest, readPlaces, writePlaces } from "./_shared.mjs";

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return badRequest("Method not allowed");

    let payload = null;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON");
    }

    const place = payload?.place;
    if (!place || typeof place !== "object") return badRequest("Missing place");

    const {
      id,
      name,
      address,
      notes,
      dateISO,
      photoBase64,
      lat,
      lon
    } = place;

    if (!isNonEmptyString(id)) return badRequest("Missing id");
    if (!isNonEmptyString(name)) return badRequest("Missing name");
    if (!isNonEmptyString(address)) return badRequest("Missing address");
    if (!isNonEmptyString(dateISO)) return badRequest("Missing dateISO");
    if (!isNumber(lat) || !isNumber(lon)) return badRequest("Invalid coordinates");
    if (photoBase64 != null && typeof photoBase64 !== "string") return badRequest("Invalid photo");

    const { items } = await readPlaces();

    // Dedup by id
    const next = Array.isArray(items) ? items.filter((x) => x?.id !== id) : [];
    next.unshift({
      id,
      name: name.trim(),
      address: address.trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
      dateISO,
      photoBase64: typeof photoBase64 === "string" ? photoBase64 : "",
      lat,
      lon,
      createdAt: new Date().toISOString()
    });

    // Keep max 300 items to avoid unbounded growth
    const capped = next.slice(0, 300);
    await writePlaces(capped);

    return json({ ok: true, items: capped });
  } catch (e) {
    return json({ ok: false, error: "Server error" }, 500);
  }
};
