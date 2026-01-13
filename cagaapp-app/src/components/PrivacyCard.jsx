import React from "react";

export default function PrivacyCard() {
  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <div className="h2">Privacy</div>
      <p className="p" style={{ marginTop: 8 }}>
        Nessun account. Nessun login. Nessun tracking pubblicitario.
        Usiamo la tua posizione solo per calcolare le distanze e mostrarti i bagni vicini.
      </p>
      <div className="kpi" style={{ marginTop: 12 }}>
        <span className="pill">Zero account</span>
        <span className="pill">Zero tracking</span>
        <span className="pill">Solo GPS necessario</span>
      </div>
    </div>
  );
}
