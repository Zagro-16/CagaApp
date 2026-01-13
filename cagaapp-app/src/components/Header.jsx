import React from "react";

export default function Header({ emergency, onToggleEmergency }) {
  return (
    <div className="card" style={{ padding: 14, marginTop: 14 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 12 }}>
          <img
            src="/app/assets/caga.png"
            alt="CagaApp"
            style={{ height: 44, width: "auto" }}
          />
        </div>

        <button
          className={`btn ${emergency ? "btn--danger" : "btn--blue"}`}
          onClick={onToggleEmergency}
          aria-pressed={emergency}
          title="Modalità emergenza"
        >
          {emergency ? "🚨 EMERGENZA: ON" : "🚨 Emergenza"}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <p className="p">
          Trova i bagni più vicini con GPS e OpenStreetMap. Interfaccia pensata per situazioni di urgenza.
        </p>
      </div>
    </div>
  );
}
