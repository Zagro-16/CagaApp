import React, { useMemo } from "react";

const WALK_ICON = `${import.meta.env.BASE_URL}assets/walk.png`;

function formatDistance(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function KindBadge({ kind }) {
  const isToilet = kind === "toilet";
  return (
    <span className={`badge ${isToilet ? "badge--ok" : "badge--prob"}`}>
      {isToilet ? "CONFERMATO" : "PROBABILE"}
    </span>
  );
}

export default function ResultsList({
  items,
  selectedId,
  emergency,
  onSelect,
  getAvgStars,
  getReviewCount
}) {
  const safe = Array.isArray(items) ? items : [];

  const visible = useMemo(() => {
    // in emergenza mostriamo meno roba
    const max = emergency ? 8 : 30;
    return safe.slice(0, max);
  }, [safe, emergency]);

  if (!visible.length) {
    return <div className="small">Nessun risultato ancora. Premi “Cerca”.</div>;
  }

  return (
    <div className="list">
      {visible.map((it) => {
        const id = it?.id || "";
        const isSelected = id && id === selectedId;

        const avg = typeof getAvgStars === "function" ? getAvgStars(id) : 0;
        const cnt = typeof getReviewCount === "function" ? getReviewCount(id) : 0;

        return (
          <button
            key={id || Math.random()}
            type="button"
            className={`item ${isSelected ? "item--selected" : ""}`}
            onClick={() => onSelect?.(it)}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div className="item__title" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it?.name || "Luogo"}
                  </span>
                  <KindBadge kind={it?.kind} />
                </div>

                <div className="small" style={{ opacity: 0.9 }}>
                  {it?.kind === "likely" ? `Categoria: ${it?.category || "Luogo"}` : "Bagno pubblico (OSM)"}
                </div>
              </div>

              <div className="pill" title="Distanza stimata" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <img src={WALK_ICON} alt="" width="16" height="16" style={{ opacity: 0.95 }} />
                <b>{formatDistance(it?.distanceMeters)}</b>
              </div>
            </div>

            <div className="item__meta">
              <span className="pill">⭐ {avg ? avg.toFixed(1) : "—"}</span>
              <span className="pill">{cnt} recensioni</span>

              {it?.meta?.wheelchair ? <span className="pill">♿ {it.meta.wheelchair}</span> : null}
              {it?.meta?.fee ? <span className="pill">€ {it.meta.fee}</span> : null}
              {it?.meta?.opening ? <span className="pill">⏰ orari</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
