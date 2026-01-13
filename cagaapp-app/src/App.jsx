import React, { useEffect, useMemo, useRef, useState } from "react";

import Header from "./components/Header.jsx";
import Toast from "./components/Toast.jsx";
import GeoGate from "./components/GeoGate.jsx";
import RadiusControl from "./components/RadiusControl.jsx";
import ResultsList from "./components/ResultsList.jsx";
import EmergencyToggle from "./components/EmergencyToggle.jsx";
import Reviews from "./components/Reviews.jsx";
import AddPlace from "./components/AddPlace.jsx";
import PrivacyCard from "./components/PrivacyCard.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import UpdateBadge from "./components/UpdateBadge.jsx";

import { readJSON, writeJSON, ensureArray, ensureObject } from "./lib/safeStorage.js";
import { getCurrentPosition, GEO_ERRORS } from "./lib/geo.js";
import { searchToilets } from "./lib/overpass.js";
import { distanceMeters } from "./lib/distance.js";
import { fetchPublicPlaces } from "./lib/api.js";
import { computeUtilityScore } from "./lib/ranking.js";

const LS_KEYS = {
  radius: "cagaapp_radius_v1",
  emergency: "cagaapp_emergency_v1",
  reviews: "cagaapp_reviews_v1"
};

const WALK_ICON = `${import.meta.env.BASE_URL}assets/walk.png`;

function formatDistance(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function openGoogleMapsDirections(lat, lon, mode = "walking") {
  const travelmode = mode === "driving" ? "driving" : "walking";
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${lat},${lon}`
  )}&travelmode=${travelmode}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function registerServiceWorker(onToast) {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });

      if (reg.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new Event("cagaapp:sw-update-ready"));
        onToast?.({
          type: "info",
          title: "Aggiornamento pronto",
          message: "Tocca 'Aggiorna ora' per applicare la nuova versione."
        });
      }

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;

        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event("cagaapp:sw-update-ready"));
            onToast?.({
              type: "info",
              title: "Aggiornamento disponibile",
              message: "Tocca 'Aggiorna ora' per applicare la nuova versione."
            });
          }
        });
      });
    } catch {
      // non critico
    }
  });
}

function DistancePill({ meters }) {
  const label = formatDistance(meters);
  if (!label) return null;

  return (
    <span
      className="pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px"
      }}
      title="Distanza stimata"
    >
      <img
        src={WALK_ICON}
        alt=""
        width="18"
        height="18"
        style={{ opacity: 0.95, filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.25))" }}
      />
      <span style={{ fontWeight: 1000 }}>{label}</span>
    </span>
  );
}

export default function App() {
  const [toast, setToast] = useState(null);

  const [emergency, setEmergency] = useState(() => !!readJSON(LS_KEYS.emergency, false));
  const [radius, setRadius] = useState(() => {
    const v = Number(readJSON(LS_KEYS.radius, 800));
    return Number.isFinite(v) ? Math.max(50, Math.min(5000, v)) : 800;
  });

  const [geoStatus, setGeoStatus] = useState({ state: "idle", message: "" });
  const [pos, setPos] = useState(null);

  const [loading, setLoading] = useState(false);
  const [osmResults, setOsmResults] = useState([]);
  const [publicPlaces, setPublicPlaces] = useState([]);
  const [selected, setSelected] = useState(null);

  const [reviewsByPlace, setReviewsByPlace] = useState(() =>
    ensureObject(readJSON(LS_KEYS.reviews, {}))
  );

  const effectiveRadius = emergency ? Math.min(radius, 300) : radius;

  // ✅ Persist robusto (nessun return)
  useEffect(() => {
    writeJSON(LS_KEYS.emergency, !!emergency);
  }, [emergency]);

  useEffect(() => {
    writeJSON(LS_KEYS.radius, radius);
  }, [radius]);

  useEffect(() => {
    writeJSON(LS_KEYS.reviews, reviewsByPlace);
  }, [reviewsByPlace]);

  // ✅ SW registration once (nessun return)
  const swOnce = useRef(false);
  useEffect(() => {
    if (swOnce.current) return;
    swOnce.current = true;
    registerServiceWorker((t) => setToast(t));
  }, []);

  // ✅ Load public places (cleanup SEMPRE funzione)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const items = await fetchPublicPlaces();
        if (!alive) return;
        setPublicPlaces(ensureArray(items));
      } catch {
        // non critico
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function refreshPublicPlaces() {
    try {
      const items = await fetchPublicPlaces();
      setPublicPlaces(ensureArray(items));
    } catch {
      // non critico
    }
  }

  async function requestGeo() {
    setGeoStatus({ state: "requesting", message: "" });
    try {
      const p = await getCurrentPosition({ timeoutMs: 12000, highAccuracy: true });
      setPos(p);
      setGeoStatus({ state: "ready", message: "" });
      setToast({ type: "success", title: "GPS attivo", message: "Posizione acquisita." });
    } catch (err) {
      if (err && typeof err.code === "number") {
        if (err.code === GEO_ERRORS.PERMISSION_DENIED) {
          setGeoStatus({
            state: "denied",
            message: "Permesso negato. Consenti la posizione nelle impostazioni del browser."
          });
          return;
        }
        if (err.code === GEO_ERRORS.TIMEOUT) {
          setGeoStatus({ state: "error", message: "Timeout GPS. Spostati all’aperto e riprova." });
          return;
        }
        setGeoStatus({ state: "error", message: "Posizione non disponibile. Riprova tra poco." });
        return;
      }
      setGeoStatus({ state: "error", message: "Errore GPS. Controlla che la posizione sia attiva." });
    }
  }

  async function runSearch() {
    if (!pos) {
      setToast({
        type: "error",
        title: "GPS non attivo",
        message: "Consenti la geolocalizzazione per cercare i bagni vicini."
      });
      return;
    }

    setLoading(true);
    setSelected(null);

    try {
      const results = await searchToilets({
        lat: pos.lat,
        lon: pos.lon,
        radiusMeters: effectiveRadius
      });

      const safe = ensureArray(results);
      setOsmResults(safe);

      if (safe.length === 0) {
        setToast({
          type: "info",
          title: "Nessun bagno trovato",
          message: "Aumenta il raggio o spostati di qualche metro."
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        title: "Ricerca non riuscita",
        message: e?.message || "Errore Overpass/OpenStreetMap."
      });
      setOsmResults([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleEmergency() {
    setEmergency((v) => !v);
    setToast({
      type: "info",
      title: "Modalità emergenza",
      message: !emergency ? "Attiva: raggio ridotto e UI più diretta." : "Disattivata."
    });
  }

  function getReviewsFor(placeId) {
    if (!placeId) return [];
    const obj = ensureObject(reviewsByPlace);
    return ensureArray(obj[placeId]);
  }

  function getAvgStars(placeId) {
    const arr = getReviewsFor(placeId);
    if (!arr.length) return 0;
    const sum = arr.reduce((acc, r) => acc + (Number(r?.stars) || 0), 0);
    return sum / arr.length;
  }

  const mergedResults = useMemo(() => {
    if (!pos) return [];

    const osm = ensureArray(osmResults).map((it) => ({
      ...it,
      distanceMeters: distanceMeters(pos.lat, pos.lon, it.lat, it.lon)
    }));

    const pub = ensureArray(publicPlaces).map((p) => ({
      source: "public",
      id: p.id,
      name: p.name || "Luogo aggiunto",
      lat: p.lat,
      lon: p.lon,
      meta: {
        opening: "",
        fee: "",
        access: "",
        notes: p.notes || "",
        address: p.address || ""
      },
      distanceMeters: distanceMeters(pos.lat, pos.lon, p.lat, p.lon),
      photoBase64: p.photoBase64 || ""
    }));

    const all = [...osm, ...pub].filter((x) => Number.isFinite(x?.distanceMeters));

    all.sort((a, b) => {
      const da = Number(a?.distanceMeters ?? Infinity);
      const db = Number(b?.distanceMeters ?? Infinity);
      if (da !== db) return da - db;

      const ua = computeUtilityScore(a);
      const ub = computeUtilityScore(b);
      if (ua !== ub) return ub - ua;

      return (a?.name || "").localeCompare(b?.name || "");
    });

    return all;
  }, [pos, osmResults, publicPlaces]);

  useEffect(() => {
    if (!selected?.id) return;
    const stillThere = mergedResults.some((x) => x?.id === selected.id);
    if (!stillThere) setSelected(null);
  }, [mergedResults, selected?.id]);

  const selectedId = selected?.id || null;
  const selectedAvg = selectedId ? getAvgStars(selectedId) : 0;
  const selectedCount = selectedId ? getReviewsFor(selectedId).length : 0;

  const nearest = mergedResults[0];

  return (
    <div className="container">
      <Header emergency={emergency} onToggleEmergency={toggleEmergency} />

      <UpdateBadge />
      <InstallPrompt />

      <EmergencyToggle emergency={emergency} />
      <GeoGate status={geoStatus} onRequest={requestGeo} />

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ minWidth: 220 }}>
            <div className="h2">Trova bagni vicini</div>
            <div className="small" style={{ marginTop: 4 }}>
              Risultati ordinati per distanza + utilità. Navigazione 1 tap.
            </div>
          </div>

          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn btn--primary" onClick={runSearch} disabled={loading}>
              {loading ? "Ricerca..." : emergency ? "Cerca ORA" : "Cerca adesso"}
            </button>
            <button className="btn" onClick={requestGeo}>
              Aggiorna GPS
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <RadiusControl
            value={radius}
            effectiveValue={effectiveRadius}
            emergency={emergency}
            onChange={(v) => setRadius(v)}
          />
        </div>

        {pos ? (
          <div className="kpi" style={{ marginTop: 14 }}>
            <div className="kpi__item">
              <div className="kpi__label">Raggio</div>
              <div className="kpi__value">{formatDistance(effectiveRadius)}</div>
              {emergency && <div className="badge badge--warn">EMERGENZA</div>}
            </div>

            <div className="kpi__item">
              <div className="kpi__label">Trovati</div>
              <div className="kpi__value">{mergedResults.length}</div>
              <div className="kpi__hint">OSM + luoghi pubblici</div>
            </div>

            <div className="kpi__item">
              <div className="kpi__label">Più vicino</div>
              <div className="kpi__value">{nearest ? <DistancePill meters={nearest.distanceMeters} /> : "—"}</div>
              <div className="kpi__hint">{nearest?.name || ""}</div>
            </div>
          </div>
        ) : (
          <div className="small" style={{ marginTop: 14, opacity: 0.9 }}>
            Attiva il GPS per vedere i bagni vicini.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="h2" style={{ marginBottom: 2 }}>
              Risultati
            </div>
            <div className="small">Tocca un risultato per dettagli e navigazione.</div>
          </div>

          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn" onClick={refreshPublicPlaces}>
              Aggiorna online
            </button>
            <button
              className="btn"
              onClick={() => {
                setSelected(null);
                setOsmResults([]);
                setToast({ type: "info", title: "Pulito", message: "Risultati locali rimossi." });
              }}
            >
              Pulisci
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ResultsList
            items={mergedResults}
            selectedId={selectedId}
            emergency={emergency}
            onSelect={(item) => setSelected(item || null)}
            getAvgStars={(placeId) => getAvgStars(placeId)}
            getReviewCount={(placeId) => getReviewsFor(placeId).length}
          />
        </div>
      </div>

      {selected ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <div className="h2" style={{ marginBottom: 6 }}>
                {selected.name || "Bagno"}
              </div>

              <div className="row" style={{ flexWrap: "wrap", marginTop: 6 }}>
                <DistancePill meters={selected.distanceMeters} />
              </div>

              <div className="small" style={{ marginTop: 10 }}>
                Valutazione: <b>{selectedAvg ? selectedAvg.toFixed(1) : "—"}</b> ⭐{" "}
                <span style={{ opacity: 0.85 }}>({selectedCount} recensioni)</span>
              </div>
            </div>

            <div className="row" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn--primary" onClick={() => openGoogleMapsDirections(selected.lat, selected.lon, "walking")}>
                Naviga a piedi
              </button>
              <button className="btn btn--blue" onClick={() => openGoogleMapsDirections(selected.lat, selected.lon, "driving")}>
                Naviga auto
              </button>
              <button className="btn" onClick={() => setSelected(null)}>
                Chiudi
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Reviews
              placeId={selectedId}
              placeName={selected?.name || "Luogo"}
              reviews={getReviewsFor(selectedId)}
              onAdd={(review) => {
                if (!selectedId) return;
                setReviewsByPlace((prev) => {
                  const obj = ensureObject(prev);
                  const arr = ensureArray(obj[selectedId]);
                  return { ...obj, [selectedId]: [review, ...arr] };
                });
                setToast({ type: "success", title: "Recensione salvata", message: "Grazie!" });
              }}
              onDelete={(reviewId) => {
                if (!selectedId) return;
                setReviewsByPlace((prev) => {
                  const obj = ensureObject(prev);
                  const arr = ensureArray(obj[selectedId]).filter((r) => r?.id !== reviewId);
                  return { ...obj, [selectedId]: arr };
                });
                setToast({ type: "info", title: "Recensione eliminata", message: "Ok." });
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div className="h2">Aggiungi luogo</div>
        <div className="small" style={{ marginTop: 4 }}>
          Puoi salvare un bagno/luogo utile: foto, note e coordinate automatiche.
        </div>

        <div style={{ marginTop: 12 }}>
          <AddPlace
            currentPos={pos}
            onNeedGPS={() =>
              setToast({ type: "error", title: "Serve il GPS", message: "Attiva la posizione per aggiungere un luogo." })
            }
            onSaved={async () => {
              setToast({ type: "success", title: "Inviato", message: "Luogo salvato online. Aggiorno elenco…" });
              await refreshPublicPlaces();
            }}
            onError={(msg) =>
              setToast({ type: "error", title: "Errore salvataggio", message: msg || "Operazione non riuscita." })
            }
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PrivacyCard />
      </div>

      <div style={{ height: 18 }} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
