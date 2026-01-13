import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const placeId = url.searchParams.get("placeId") || "";
    if (!placeId) {
      return Response.json({ ok: true, items: [] }, { status: 200 });
    }

    const store = getStore("reviews");
    const key = `place:${placeId}`;
    const items = (await store.get(key, { type: "json" })) || [];

    return Response.json({ ok: true, items }, { status: 200 });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
};
