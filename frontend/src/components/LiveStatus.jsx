import { useCallback, useEffect, useState } from "react";
import api, { errorMessage } from "../api/client";
import StatusBadge from "./StatusBadge";

const SOURCE = { airlabs: "AirLabs", opensky: "OpenSky Network", internal: "Airline report" };

/** Real-time status. Polls the backend (which talks to AirLabs / OpenSky and caches for 60s). */
export default function LiveStatus({ flightId, pollMs = 60000 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/flights/${flightId}/live-status/`);
      setData(res.data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't refresh the flight status."));
    } finally {
      setLoading(false);
    }
  }, [flightId]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const pos = data?.position;
  return (
    <section className="live" aria-label="Live flight status">
      <header className="live-head">
        <h3>Flight status</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={loading}>Refresh</button>
      </header>
      {loading && !data && <p className="muted">Checking status…</p>}
      {error && <p className="field-error">{error}</p>}
      {data && (
        <>
          <div className="live-row">
            <StatusBadge status={data.scheduled_status} delay={data.delay_minutes} />
            <span className={`live-dot${data.live ? " is-live" : ""}`}>{data.live ? "Tracking live" : "Not tracked live"}</span>
            <span className="muted small">Source: {SOURCE[data.source] ?? data.source}</span>
          </div>
          {pos ? (
            <dl className="live-grid">
              <div><dt>Latitude</dt><dd>{pos.latitude?.toFixed(3)}</dd></div>
              <div><dt>Longitude</dt><dd>{pos.longitude?.toFixed(3)}</dd></div>
              <div><dt>Altitude</dt><dd>{pos.altitude_m != null ? `${Math.round(pos.altitude_m)} m` : "n/a"}</dd></div>
              <div><dt>Speed</dt><dd>{pos.speed_kmh != null ? `${pos.speed_kmh} km/h` : "n/a"}</dd></div>
              <div><dt>Heading</dt><dd>{pos.heading != null ? `${Math.round(pos.heading)}°` : "n/a"}</dd></div>
              <div><dt>Phase</dt><dd>{data.phase ?? "n/a"}</dd></div>
            </dl>
          ) : (
            <p className="muted small">{data.message}</p>
          )}
          <p className="muted small">Updated {new Date(data.fetched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST. Refreshes every minute.</p>
        </>
      )}
    </section>
  );
}
