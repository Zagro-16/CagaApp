import { json, badRequest, readPlaces, writePlaces } from "./_shared.mjs";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return badRequest("Method not allowed");

    let payload = null;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return badRequest("Invalid JSON");
    }

    const id = payload?.id;
    if (typeof id !== "string" || !id.trim()) return badRequest("Missing id");

    const { items } = await readPlaces();
    const next = Array.isArray(items) ? items.filter((x) => x?.id !== id) : [];

    await writePlaces(next);
    return json({ ok: true, items: next });
  } catch (e) {
    return json({ ok: false, error: "Server error" }, 500);
  }
};
