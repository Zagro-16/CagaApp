import React, { useEffect, useState } from "react";

export default function UpdateBadge() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    function onUpdateReady() {
      setWaiting(true);
    }
    window.addEventListener("cagaapp:sw-update-ready", onUpdateReady);

    function onControllerChange() {
      window.location.reload();
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    return () => {
      window.removeEventListener("cagaapp:sw-update-ready", onUpdateReady);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, []);

  async function applyUpdate() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.waiting) return;
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // no crash
    }
  }

  if (!waiting) return null;

  return (
    <div className="updatebar">
      <div className="updatebar__text">
        <b>Aggiornamento pronto</b>
        <div className="small" style={{ opacity: 0.9 }}>Tocca per aggiornare subito l’app.</div>
      </div>
      <button className="btn btn--primary" onClick={applyUpdate}>Aggiorna ora</button>
    </div>
  );
}
