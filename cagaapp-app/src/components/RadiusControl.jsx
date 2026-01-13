import React, { useMemo } from "react";

const MIN = 50;
const MAX = 5000;

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function format(m) {
  if (!Number.isFinite(m)) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export default function RadiusControl({
  value,
  effectiveValue,
  emergency,
  onChange
}) {
  // onChange deve essere funzione, altrimenti non crashiamo
  const canChange = typeof onChange === "function";

  const v = clamp(value, MIN, MAX);
  const eff = clamp(effectiveValue ?? v, MIN, MAX);

  // Step dinamico: più usabile
  const step = useMemo(() => {
    if (v <= 300) return 50;
    if (v <= 1000) return 100;
    if (v <= 2500) return 250;
    return 500;
  }, [v]);

  function setNext(next) {
    if (!canChange) return;
    onChange(clamp(next, MIN, MAX));
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <div className="h2" style={{ marginBottom: 6 }}>Raggio di ricerca</div>
          <div className="small">
            Seleziona da <b>{MIN} m</b> a <b>{format(MAX)}</b>.{" "}
            {emergency ? (
              <span style={{ opacity: 0.95 }}>
                In emergenza il raggio effettivo viene ridotto automaticamente.
              </span>
            ) : null}
          </div>
        </div>

        <div className="row" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <span className="pill" title="Raggio impostato">
            Impostato: <b>{format(v)}</b>
          </span>
          {emergency ? (
            <span className="pill" title="Raggio usato in emergenza">
              Effettivo: <b>{format(eff)}</b>
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          className="input"
          type="range"
          min={MIN}
          max={MAX}
          step={50}
          value={v}
          onChange={(e) => setNext(e.target.value)}
          aria-label="Selettore raggio"
        />
      </div>

      <div className="row" style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => setNext(v - step)} disabled={!canChange}>
            − {step >= 1000 ? `${step / 1000}km` : `${step}m`}
          </button>
          <button className="btn" type="button" onClick={() => setNext(v + step)} disabled={!canChange}>
            + {step >= 1000 ? `${step / 1000}km` : `${step}m`}
          </button>
        </div>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn btn--ghost" type="button" onClick={() => setNext(300)} disabled={!canChange}>
            300m
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setNext(800)} disabled={!canChange}>
            800m
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setNext(2000)} disabled={!canChange}>
            2km
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => setNext(5000)} disabled={!canChange}>
            5km
          </button>
        </div>
      </div>

      {!canChange ? (
        <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
          Nota tecnica: callback <code>onChange</code> non disponibile.
        </div>
      ) : null}
    </div>
  );
}
