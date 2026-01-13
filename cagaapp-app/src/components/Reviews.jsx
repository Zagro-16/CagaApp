import React, { useMemo, useState } from "react";
import { ensureArray, uid } from "../lib/safeStorage.js";

function starsLabel(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return "★".repeat(Math.max(0, Math.min(5, v))) + "☆".repeat(Math.max(0, 5 - Math.min(5, v)));
}

export default function Reviews({ placeId, reviewsByPlace, setReviewsByPlace }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  const reviews = useMemo(() => {
    const obj = reviewsByPlace && typeof reviewsByPlace === "object" ? reviewsByPlace : {};
    return ensureArray(obj[placeId]);
  }, [reviewsByPlace, placeId]);

  const avg = useMemo(() => {
    if (!reviews.length) return null;
    const sum = reviews.reduce((acc, r) => acc + (Number(r?.stars) || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  function addReview() {
    const cleanText = typeof text === "string" ? text.trim() : "";
    const s = Math.max(1, Math.min(5, Number(stars) || 5));

    const next = ensureArray(reviews).slice();
    next.unshift({
      id: uid("rev"),
      stars: s,
      text: cleanText,
      dateISO: new Date().toISOString()
    });

    setReviewsByPlace((prev) => {
      const safePrev = prev && typeof prev === "object" ? prev : {};
      return { ...safePrev, [placeId]: next.slice(0, 120) };
    });

    setText("");
    setStars(5);
  }

  function removeReview(id) {
    setReviewsByPlace((prev) => {
      const safePrev = prev && typeof prev === "object" ? prev : {};
      const current = ensureArray(safePrev[placeId]);
      const next = current.filter((r) => r?.id !== id);
      return { ...safePrev, [placeId]: next };
    });
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="h2">Recensioni (locali)</div>
        <div className="pill">{avg ? `Media: ${avg.toFixed(1)}/5` : "Nessuna"}</div>
      </div>

      <p className="small" style={{ marginTop: 8 }}>
        Le recensioni sono salvate sul tuo dispositivo. Non richiedono account.
      </p>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="col">
          <label className="small">Stelle</label>
          <select className="select" value={stars} onChange={(e) => setStars(Number(e.target.value))}>
            {[5,4,3,2,1].map((n) => (
              <option key={n} value={n}>{n} — {starsLabel(n)}</option>
            ))}
          </select>
        </div>

        <div className="col">
          <label className="small">Testo (opzionale)</label>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pulito, accessibile, coda, ecc."
          />
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn btn--primary" onClick={addReview}>
          Aggiungi recensione
        </button>
      </div>

      <div className="hr"></div>

      {reviews.length === 0 ? (
        <p className="p">Nessuna recensione per questo luogo.</p>
      ) : (
        <div className="list">
          {reviews.map((r) => (
            <div className="item" key={r?.id || Math.random()}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="item__title">{starsLabel(r?.stars || 0)} <span className="small">({r?.stars}/5)</span></div>
                  <div className="small">{(r?.dateISO || "").slice(0, 10)}</div>
                </div>
                <button className="btn" onClick={() => removeReview(r?.id)} style={{ minHeight: 44 }}>
                  Elimina
                </button>
              </div>
              {r?.text ? <p className="p" style={{ marginTop: 10 }}>{r.text}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
