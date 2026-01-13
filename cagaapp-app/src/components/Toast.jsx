import React from "react";

export default function Toast({ toast, onClose }) {
  if (!toast || typeof toast !== "object") return null;

  const { type = "info", title = "", message = "" } = toast;
  const border =
    type === "error"
      ? "1px solid rgba(255,122,24,0.40)"
      : type === "success"
      ? "1px solid rgba(79,209,255,0.35)"
      : "1px solid rgba(255,255,255,0.14)";

  return (
    <div
      style={{
        position: "fixed",
        left: 10,
        right: 10,
        bottom: 10,
        zIndex: 9999,
        maxWidth: 980,
        margin: "0 auto"
      }}
    >
      <div className="card" style={{ padding: 14, border, background: "rgba(0,0,0,0.40)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ paddingRight: 12 }}>
            {title ? <div className="h2">{title}</div> : null}
            {message ? <div className="small" style={{ marginTop: 6 }}>{message}</div> : null}
          </div>
          <button className="btn" onClick={onClose} style={{ minHeight: 44, padding: "10px 12px" }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
