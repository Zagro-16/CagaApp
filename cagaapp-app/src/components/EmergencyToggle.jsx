import React from "react";

export default function EmergencyToggle({ emergency }) {
  return (
    <div className="card" style={{ padding: 14, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="h2">Modalità Emergenza</div>
          <div className="small" style={{ marginTop: 4 }}>
            {emergency
              ? "UI semplificata, raggio ridotto, focus sui risultati più vicini."
              : "Attivala quando serve velocità massima e meno distrazioni."}
          </div>
        </div>
        <div className="pill">{emergency ? "ON" : "OFF"}</div>
      </div>
    </div>
  );
}
