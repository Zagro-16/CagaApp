import React, { useEffect, useMemo, useState } from "react";

function isIOS() {
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

function isStandalone() {
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari iOS legacy
  // eslint-disable-next-line no-undef
  if (typeof navigator !== "undefined" && navigator.standalone) return true;
  return false;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const ios = useMemo(() => isIOS(), []);

  useEffect(() => {
    if (isStandalone()) return;

    function onBIP(e) {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    }

    function onInstalled() {
      setVisible(false);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    if (ios) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [ios]);

  async function onInstall() {
    try {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice;
      setVisible(false);
      setDeferred(null);
    } catch {
      // no crash
    }
  }

  if (isStandalone()) return null;
  if (!visible) return null;

  if (ios) {
    return (
      <div className="installbar">
        <div className="installbar__text">
          <div className="installbar__title">Installa CagaApp</div>
          <div className="installbar__hint">
            iPhone: tocca <b>Condividi</b> → <b>Aggiungi a Home</b>
          </div>
        </div>
        <button className="btn btn--ghost" onClick={() => setVisible(false)}>
          Ok
        </button>
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className="installbar">
      <div className="installbar__text">
        <div className="installbar__title">Installa CagaApp</div>
        <div className="installbar__hint">Avvio rapido, modalità app, offline parziale.</div>
      </div>
      <button className="btn btn--primary" onClick={onInstall}>
        Installa
      </button>
      <button className="btn btn--ghost" onClick={() => setVisible(false)}>
        Non ora
      </button>
    </div>
  );
}
