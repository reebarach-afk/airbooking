import { useCallback, useEffect, useState } from "react";
import api, { errorMessage, fetchAll, fieldErrors } from "../../api/client";
import StatusBadge from "../../components/StatusBadge";
import { Alert, Empty, Field, Loading, Modal } from "../../components/ui";
import { fmtDateTime, fmtINR } from "../../lib";
import { useAirports } from "../useAirports";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const blank = { flight_number: "", airline: "", origin_code: "", destination_code: "", departure_time: "", arrival_time: "", price: "", total_seats: 180, aircraft: "", icao24: "" };

function FlightForm({ flight, onClose, onSaved }) {
  const airports = useAirports();
  const [f, setF] = useState(flight ? {
    flight_number: flight.flight_number, airline: flight.airline, origin_code: flight.origin.code, destination_code: flight.destination.code,
    departure_time: toLocalInput(flight.departure_time), arrival_time: toLocalInput(flight.arrival_time), price: flight.price,
    total_seats: flight.total_seats, aircraft: flight.aircraft, icao24: flight.icao24 ?? "",
  } : blank);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (!/^[A-Za-z0-9]{2,8}$/.test(f.flight_number)) v.flight_number = "Use 2 to 8 letters or digits, e.g. AI501.";
    if (!f.airline.trim()) v.airline = "Enter the airline name.";
    if (!f.origin_code) v.origin_code = "Choose an origin.";
    if (!f.destination_code) v.destination_code = "Choose a destination.";
    if (f.origin_code && f.origin_code === f.destination_code) v.destination_code = "Must differ from the origin.";
    if (!f.departure_time) v.departure_time = "Choose a departure time.";
    if (!f.arrival_time) v.arrival_time = "Choose an arrival time.";
    if (f.departure_time && f.arrival_time && f.arrival_time <= f.departure_time) v.arrival_time = "Arrival must be after departure.";
    if (!(Number(f.price) > 0)) v.price = "Enter a price above zero.";
    if (!(Number(f.total_seats) >= 1)) v.total_seats = "Enter at least 1 seat.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...f,
        departure_time: new Date(f.departure_time).toISOString(),
        arrival_time: new Date(f.arrival_time).toISOString(),
        total_seats: Number(f.total_seats),
        flight_number: f.flight_number.toUpperCase(),
      };
      const res = flight ? await api.patch(`/admin/flights/${flight.id}/`, payload) : await api.post("/admin/flights/", payload);
      onSaved(res.data);
    } catch (err) {
      const fe = fieldErrors(err);
      // Server names airports origin_code/destination_code on write.
      setErrors(fe);
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const airportOptions = airports.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>);
  return (
    <Modal title={flight ? `Edit ${flight.flight_number}` : "New flight"} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <div className="grid-2">
          <Field label="Flight number" htmlFor="fn" error={errors.flight_number}><input id="fn" value={f.flight_number} onChange={set("flight_number")} /></Field>
          <Field label="Airline" htmlFor="al" error={errors.airline}><input id="al" value={f.airline} onChange={set("airline")} /></Field>
          <Field label="From" htmlFor="or" error={errors.origin_code}>
            <select id="or" value={f.origin_code} onChange={set("origin_code")}><option value="">Choose airport</option>{airportOptions}</select>
          </Field>
          <Field label="To" htmlFor="de" error={errors.destination_code}>
            <select id="de" value={f.destination_code} onChange={set("destination_code")}><option value="">Choose airport</option>{airportOptions}</select>
          </Field>
          <Field label="Departure" htmlFor="dt" error={errors.departure_time}><input id="dt" type="datetime-local" value={f.departure_time} onChange={set("departure_time")} /></Field>
          <Field label="Arrival" htmlFor="at" error={errors.arrival_time}><input id="at" type="datetime-local" value={f.arrival_time} onChange={set("arrival_time")} /></Field>
          <Field label="Price per seat (₹)" htmlFor="pr" error={errors.price}><input id="pr" type="number" min="1" value={f.price} onChange={set("price")} /></Field>
          <Field label="Total seats" htmlFor="ts" error={errors.total_seats}><input id="ts" type="number" min="1" value={f.total_seats} onChange={set("total_seats")} /></Field>
          <Field label="Aircraft" htmlFor="ac"><input id="ac" value={f.aircraft} onChange={set("aircraft")} placeholder="Airbus A320neo" /></Field>
          <Field label="ICAO24 (optional)" htmlFor="ic" error={errors.icao24} hint="6-character transponder code. Enables live tracking through OpenSky.">
            <input id="ic" value={f.icao24} onChange={set("icao24")} maxLength={6} />
          </Field>
        </div>
        <Alert>{error}</Alert>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : flight ? "Save changes" : "Create flight"}</button>
        </div>
      </form>
    </Modal>
  );
}

function StatusForm({ flight, onClose, onSaved }) {
  const [status, setStatus] = useState(flight.status);
  const [delay, setDelay] = useState(flight.delay_minutes || 30);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.put(`/admin/flights/${flight.id}/status/`, { status, delay_minutes: status === "delayed" ? Number(delay) : 0 });
      onSaved(res.data);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title={`Update status for ${flight.flight_number}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Status" htmlFor="st">
          <select id="st" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="on_time">On time</option>
            <option value="delayed">Delayed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        {status === "delayed" && (
          <Field label="Delay (minutes)" htmlFor="dl"><input id="dl" type="number" min="1" max="1440" value={delay} onChange={(e) => setDelay(e.target.value)} /></Field>
        )}
        {status === "cancelled" && <p className="muted small">Travellers can no longer book this flight. Existing bookings stay visible to them as cancelled flights.</p>}
        <Alert>{error}</Alert>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Update status"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminFlights() {
  const airports = useAirports();
  const [filters, setFilters] = useState({ origin: "", destination: "", status: "" });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // {type: 'form'|'status', flight?}

  const load = useCallback(() => {
    setRows(null);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    fetchAll("/admin/flights/", params).then(setRows).catch((e) => setError(errorMessage(e)));
  }, [filters]);
  useEffect(load, [load]);

  async function remove(flight) {
    if (!window.confirm(`Delete ${flight.flight_number}? This can't be undone.`)) return;
    try {
      await api.delete(`/admin/flights/${flight.id}/`);
      setNotice(`${flight.flight_number} deleted.`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const saved = (msg) => () => { setModal(null); setNotice(msg); load(); };
  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <header className="page-head row-between">
        <h1>Flights</h1>
        <button className="btn btn-primary" onClick={() => setModal({ type: "form" })}>New flight</button>
      </header>
      <div className="toolbar">
        <label className="inline">From
          <select value={filters.origin} onChange={setF("origin")}><option value="">Any</option>{airports.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}</select>
        </label>
        <label className="inline">To
          <select value={filters.destination} onChange={setF("destination")}><option value="">Any</option>{airports.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}</select>
        </label>
        <label className="inline">Status
          <select value={filters.status} onChange={setF("status")}>
            <option value="">Any</option><option value="on_time">On time</option><option value="delayed">Delayed</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <Alert kind="success" onClose={() => setNotice("")}>{notice}</Alert>
      <Alert onClose={() => setError("")}>{error}</Alert>
      {!rows ? <Loading label="Loading flights" /> : rows.length === 0 ? (
        <Empty title="No flights match these filters" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Flight</th><th>Route</th><th>Departs</th><th>Price</th><th>Seats booked</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td data-label="Flight"><strong>{f.flight_number}</strong><br /><span className="muted small">{f.airline}</span></td>
                  <td data-label="Route">{f.origin.code} to {f.destination.code}</td>
                  <td data-label="Departs">{fmtDateTime(f.departure_time)}</td>
                  <td data-label="Price">{fmtINR(f.price)}</td>
                  <td data-label="Seats booked">{f.booked_seats} / {f.total_seats}</td>
                  <td data-label="Status"><StatusBadge status={f.status} delay={f.delay_minutes} /></td>
                  <td className="actions">
                    <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: "status", flight: f })}>Status</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: "form", flight: f })}>Edit</button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => remove(f)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal?.type === "form" && <FlightForm flight={modal.flight} onClose={() => setModal(null)} onSaved={saved(modal.flight ? "Flight updated." : "Flight created.")} />}
      {modal?.type === "status" && <StatusForm flight={modal.flight} onClose={() => setModal(null)} onSaved={saved("Status updated.")} />}
    </>
  );
}
