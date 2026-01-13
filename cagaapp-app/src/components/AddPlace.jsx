import React, { useMemo, useState } from "react";
import { uid } from "../lib/safeStorage.js";
import { addPublicPlace, deletePublicPlace } from "../lib/api.js";

export default function AddPlace({
  userPos,
  publicPlaces,
  setPublicPlaces,
  onToast
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      !!userPos &&
      typeof name === "string" && name.trim().length >= 2 &&
      typeof address === "string" && address.trim().length >= 3
    );
  }, [userPos, name, address]);

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Errore lettura file"));
      reader.readAsDataURL(file);
    });
  }

  async function onPickPhoto(e) {
    const f = e?.target?.files?.[0];
    if (!f) return;
    if (f.size > 1_200_000) { // 1.2MB
      onToast?.({ type: "error", title: "Foto troppo grande", message: "Scegli una foto più leggera (max ~1.2MB)." });
      return;
    }
    try {
      const b64 = await fileToBase64(f);
      setPhotoBase64(b64);
    } catch {
      onToast?.({ type: "error", title: "Foto", message: "Impossibile leggere la foto." });
    }
  }

  async function submit() {
    if (!canSubmit) return;

    setBusy(true);
    try {
      const place = {
        id: uid("pub"),
        name: name.trim(),
        address: address.trim(),
        notes: typeof notes === "string" ? notes.trim() : "",
        dateISO: new Date().toISOString(),
        photoBase64: photoBase64 || "",
        lat: userPos.lat,
        lon: userPos.lon
      };

      const items = await addPublicPlace(place);
      setPublicPlaces(items);

      setName("");
      setAddress("");
      setNotes("");
      setPhotoBase64("");

      onToast?.({ type: "success", title: "Salvato", message: "Luogo pubblicato online." });
    } catch (e) {
      onToast?.({ type: "error", title: "Errore salvataggio", message: e?.message || "Operazione non riuscita." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    try {
      const items = await deletePublicPlace(id);
      setPublicPlaces(items);
      onToast?.({ type: "success", title: "Eliminato", message: "Luogo rimosso." });
    } catch (e) {
      onToast?.({ type: "error", title: "Errore eliminazione", message: e?.message || "Operazione non riuscita." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="h2">Aggiungi luogo (online)</div>
        <div className="pill">{busy ? "..." : "OK"}</div>
      </div>

      <p className="small" style={{ marginTop: 8 }}>
        Il luogo viene salvato online (Netlify) ed è visibile anche ad altri utenti dell’app.
        Le coordinate vengono prese dalla tua posizione attuale.
      </p>

      {!userPos ? (
        <div className="item" style={{ marginTop: 12 }}>
          <div className="item__title">Serve la geolocalizzazione</div>
          <div className="small">Attiva il GPS per aggiungere un luogo con coordinate automatiche.</div>
        </div>
      ) : null}

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="col">
          <label className="small">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Bar Centrale" />
        </div>
        <div className="col">
          <label className="small">Indirizzo</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via / zona / riferimento" />
        </div>
      </div>

      <div className="col" style={{ marginTop: 12 }}>
        <label className="small">Note (opzionale)</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pulizia, accessibilità, codice, ecc." />
      </div>

      <div className="col" style={{ marginTop: 12 }}>
        <label className="small">Foto (opzionale)</label>
        <input className="input" type="file" accept="image/*" onChange={onPickPhoto} />
        {photoBase64 ? (
          <img
            src={photoBase64}
            alt="Anteprima"
            style={{ marginTop: 10, borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)" }}
          />
        ) : null}
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn btn--primary" disabled={!canSubmit || busy} onClick={submit}>
          Pubblica luogo
        </button>
      </div>

      <div className="hr"></div>

      <div className="h2">Luoghi pubblicati</div>
      <div className="small" style={{ marginTop: 6 }}>
        Lista online (visibile a tutti). Puoi rimuovere i luoghi inseriti.
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {(Array.isArray(publicPlaces) ? publicPlaces : []).slice(0, 30).map((p) => (
          <div className="item" key={p?.id || Math.random()}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="item__title">{p?.name || "Luogo"}</div>
                <div className="small">{p?.address || ""}</div>
                {p?.notes ? <div className="small" style={{ marginTop: 6 }}>{p.notes}</div> : null}
              </div>
              <button className="btn" onClick={() => remove(p?.id)} disabled={busy} style={{ minHeight: 44 }}>
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
