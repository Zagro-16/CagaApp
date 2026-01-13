export const GEO_ERRORS = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3
};

export function isHttpsContext() {
  // Geolocation richiede HTTPS (o localhost).
  const { protocol, hostname } = window.location;
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}

export function getCurrentPosition({ timeoutMs = 12000, highAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation non supportata dal browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lon = pos?.coords?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          reject(new Error("Coordinate non valide."));
          return;
        }
        resolve({ lat, lon, accuracy: pos.coords.accuracy ?? null });
      },
      (err) => reject(err),
      { enableHighAccuracy: !!highAccuracy, timeout: timeoutMs, maximumAge: 10_000 }
    );
  });
}
