import { json, readPlaces } from "./_shared.mjs";

export const handler = async () => {
  try {
    const data = await readPlaces();
    return json({ ok: true, items: data.items });
  } catch (e) {
    return json({ ok: false, error: "Server error" }, 500);
  }
};
