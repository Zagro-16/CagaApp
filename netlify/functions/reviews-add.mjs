import { getStore } from "@netlify/blobs";

function clampStars(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 5;
  return Math.max(1, Math.min(5, Math.round(x)));
}

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const placeId = String(body.placeId || "");
    if (!placeId) return Response.json({ ok: false, error: "placeId missing" }, { status: 400 });

    const review = {
      id: String(body.id || `r_${Date.now()}`),
      placeId,
      placeName: String(body.placeName || ""),
      stars: clampStars(body.stars),
      text: String(body.text || "").slice(0, 500),
      createdAt: Number(body.createdAt || Date.now())
    };

    const store = getStore("reviews");
    const key = `place:${placeId}`;

    const current = (await store.get(key, { type: "json" })) || [];
    const next = [review, ...current].slice(0, 200); // limite per evitare crescita infinita

    await store.setJSON(key, next);

    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
};
