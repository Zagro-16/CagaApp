import React, { useEffect, useMemo, useState } from "react";
import { fetchCloudReviews, addCloudReview } from "../lib/api.js";

function uid() {
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function vibrate(ms = 30) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(ms);
  } catch {}
}

export default function Reviews({ placeId, placeName, reviews, onAdd, onDelete }) {
  const local = Array.isArray(reviews) ? reviews : [];

  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  const [savedPulse, setSavedPulse] = useState(false);

  // cloud state
  const [cloud, setCloud] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");

  const canSubmit = !!placeId && stars >= 1 && stars <= 5;

  // carica cloud quando cambia placeId
  useEffect(() => {
    let alive = true;
    setCloud([]);
    setCloudError("");

    if (!placeId) return;

    (async () => {
      setCloudLoading(true);
      try {
        const items = await fetchCloudReviews(placeId);
        if (!alive) return;
        setCloud(Array.isArray(items) ? items : []);
      } catch (e) {
        if (!alive) return;
        setCloudError(e?.message || "Errore caricamento recensioni online");
      } finally {
        if (alive) setCloudLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [placeId]);

  // merge Local + Cloud (dedupe by id)
  const merged = useMemo(() => {
    const map = new Map();

    for (const r of cloud) {
      if (r?.id) map.set(r.id, { ...r, __src: "online" });
    }
    for (const r of local) {
      if (r?.id && !map.has(r.id)) map.set(r.id, { ...r, __src: "local" });
    }

    return Array.from(map.values()).sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
  }, [local, cloud]);

  async function addReview() {
    if (!canSubmit) return;

    const review = {
      id: uid(),
      placeId,
      placeName: placeName || "",
      stars: Number(stars) || 5,
      text: String(text || "").trim().slice(0, 500),
      createdAt: Date.now()
    };

    // 1) salva subito local (UI instant)
    onAdd?.(review);

    // 2) badge + vibrazione
    setSavedPulse(true);
    vibrate([10, 25, 10]);
    setTimeout(() => setSavedPulse(false), 1400);

    // 3) reset form
    setText("");
    setStars(5);

    // 4) invia cloud (se fallisce, rimane comunque local)
    try {
      setCloudError("");
      await addCloudReview(review);

      // ottimistica: aggiungo anche in cloud list
      setCloud((prev) => [review, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
    } catch (e) {
      setCloudError("Salvata sul tuo dispositivo, ma NON online (connessione/servizio).");
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="h2">Recensioni</div>
          <div className="small" style={{ marginTop: 2, opacity: 0.9 }}>
            {placeId ? "Locali + Online (condivise)" : "Seleziona un luogo per recensire."}
          </div>
        </div>

        {savedPulse ? (
          <span className="badge badge--ok" aria-live="polite">
            Salvata ✅
          </span>
        ) : null}
      </div>

      <div className="hr" />

      {/* status cloud */}
      {placeId ? (
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div className="small" style={{ opacity: 0.9 }}>
            Online: {cloudLoading ? "caricamento…" : cloud.length}
          </div>
          {cloudError ? (
            <div className="small" style={{ opacity: 0.95 }}>
              ⚠️ {cloudError}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="col" style={{ gap: 10, marginTop: 10 }}>
        <div className="small" style={{ fontWeight: 900, opacity: 0.9 }}>
          Stelle
        </div>
        <select className="select" value={stars} onChange={(e) => setStars(Number(e.target.value))}>
          <option value={5}>5 — ★★★★★</option>
          <option value={4}>4 — ★★★★☆</option>
          <option value={3}>3 — ★★★☆☆</option>
          <option value={2}>2 — ★★☆☆☆</option>
          <option value={1}>1 — ★☆☆☆☆</option>
        </select>

        <div className="small" style={{ fontWeight: 900, opacity: 0.9 }}>
          Testo (opzionale)
        </div>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pulito, accessibile, coda, ecc."
        />

        <button className="btn btn--primary" onClick={addReview} disabled={!canSubmit}>
          Pubblica recensione
        </button>
      </div>

      <div className="hr" />

      {!merged.length ? (
        <div className="small" style={{ opacity: 0.9 }}>
          Nessuna recensione per questo luogo.
        </div>
      ) : (
        <div className="list">
          {merged.map((r) => (
            <div key={r.id} className="item" style={{ cursor: "default" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <div className="item__title">
                  ⭐ {Number(r.stars || 0).toFixed(0)} / 5{" "}
                  <span className={`badge ${r.__src === "online" ? "badge--ok" : "badge--prob"}`} style={{ marginLeft: 8 }}>
                    {r.__src === "online" ? "ONLINE" : "LOCALE"}
                  </span>
                </div>

                {/* elimina SOLO locale (senza funzione delete cloud) */}
                {r.__src === "local" ? (
                  <button className="btn btn--ghost" onClick={() => onDelete?.(r.id)} style={{ minHeight: 40 }}>
                    Elimina
                  </button>
                ) : null}
              </div>

              {r.text ? (
                <div className="small" style={{ marginTop: 6, opacity: 0.92 }}>
                  {r.text}
                </div>
              ) : null}

              <div className="small" style={{ marginTop: 8, opacity: 0.7 }}>
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
