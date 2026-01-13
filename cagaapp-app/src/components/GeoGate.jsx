import React from "react";
import { isHttpsContext } from "../lib/geo.js";

export default function GeoGate({ status, onRequest }) {
  const httpsOk = isHttpsContext();

  const boxStyle = { padding: 16, marginTop: 12 };

  if (!httpsOk) {
    return (
      <div className="card" style={boxStyle}>
        <div className="h2">HTTPS richiesto su smartphone</div>
        <p className="p" style={{ marginTop: 8 }}>
          La geolocalizzazione funziona solo su connessione sicura (HTTPS). Su Netlify è automatico.
        </p>
      </div>
    );
  }

  if (status?.state === "ready") return null;

  const title =
    status?.state === "denied"
      ? "Permesso GPS negato"
      : status?.state === "error"
      ? "Errore geolocalizzazione"
      : "Attiva la geolocalizzazione";

  const msg =
    status?.state === "denied"
      ? "Apri le impostazioni del browser e consenti la posizione per usare la ricerca."
      : status?.message ||
        "Serve la posizione per mostrarti i bagni più vicini. Nessun account, nessun tracking.";

  return (
    <div className="card" style={boxStyle}>
      <div className="h2">{title}</div>
      <p className="p" style={{ marginTop: 8 }}>{msg}</p>
      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn btn--primary" onClick={onRequest}>
          Consenti GPS
        </button>
      </div>
    </div>
  );
}
