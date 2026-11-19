import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { errorMessage, fieldErrors } from "../api/client";
import FlightTicket from "../components/FlightTicket";
import LiveStatus from "../components/LiveStatus";
import { Alert, Empty, Field, Loading } from "../components/ui";
import { useTrips } from "../context/TripsContext";
import { fmtDateTime, fmtINR, isPast } from "../lib";

const NAME_RE = /^[A-Za-z .'-]{2,}$/;
const blankPax = () => ({ name: "", age: "" });

function validate(passengers, pay) {
  const e = { passengers: passengers.map(() => ({})), pay: {} };
  let ok = true;
  passengers.forEach((p, i) => {
    if (!NAME_RE.test(p.name.trim())) { e.passengers[i].name = "Enter the name as on the ID (letters only)."; ok = false; }
    const age = Number(p.age);
    if (p.age === "" || !Number.isInteger(age) || age < 0 || age > 120) { e.passengers[i].age = "Enter an age from 0 to 120."; ok = false; }
  });
  if (pay.method === "card") {
    if (!/^\d{13,19}$/.test(pay.card_number.replace(/\s/g, ""))) { e.pay.card_number = "Enter a valid card number."; ok = false; }
    const m = pay.expiry.match(/^(\d{2})\/(\d{2})$/);
    const expired = m && new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59) < new Date();
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || expired) { e.pay.expiry = "Use a future date as MM/YY."; ok = false; }
    if (!/^\d{3,4}$/.test(pay.cvv)) { e.pay.cvv = "3 or 4 digits."; ok = false; }
  }
  if (pay.method === "upi" && !/^[\w.-]{2,}@\w{2,}$/.test(pay.upi_id)) { e.pay.upi_id = "Enter a UPI ID like name@bank."; ok = false; }
  return { ok, errors: e };
}

export default function FlightDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { createBooking } = useTrips();
  const [flight, setFlight] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [passengers, setPassengers] = useState([blankPax()]);
  const [pay, setPay] = useState({ method: "card", card_number: "", expiry: "", cvv: "", upi_id: "", bank: "" });
  const [errors, setErrors] = useState({ passengers: [], pay: {} });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFlight(null);
    api.get(`/flights/${id}/`).then((r) => setFlight(r.data)).catch((e) => setLoadError(errorMessage(e, "Flight not found.")));
  }, [id]);

  const maxPax = flight ? Math.min(9, flight.available_seats) : 1;
  const total = useMemo(() => (flight ? Number(flight.price) * passengers.length : 0), [flight, passengers.length]);

  if (loadError) return <Empty title="Flight unavailable" action={<Link to="/flights" className="btn btn-primary">Back to search</Link>}>{loadError}</Empty>;
  if (!flight) return <Loading label="Loading flight" />;

  const departed = isPast(flight.departure_time);
  const bookable = !departed && flight.status !== "cancelled" && flight.available_seats > 0;

  const setPax = (i, k) => (e) => setPassengers((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: e.target.value } : p)));
  const setPayField = (k) => (e) => setPay((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    const v = validate(passengers, pay);
    setErrors(v.errors);
    if (!v.ok) return;
    setBusy(true);
    try {
      const payment = { method: pay.method };
      if (pay.method === "card") payment.card_number = pay.card_number.replace(/\s/g, "");
      if (pay.method === "upi") payment.upi_id = pay.upi_id;
      const booking = await createBooking({
        flight: flight.id,
        passengers: passengers.map((p) => ({ name: p.name.trim(), age: Number(p.age) })),
        payment,
      });
      navigate(`/trips/${booking.id}`, { state: { justBooked: true } });
    } catch (err) {
      const fe = fieldErrors(err);
      setError(errorMessage(err));
      if (err.response?.status === 400 && fe.passengers) {
        // Seat count changed under us: refresh the flight so the numbers are right.
        api.get(`/flights/${id}/`).then((r) => setFlight(r.data)).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link to="/flights" className="back">Back to results</Link>
      <header className="page-head"><h1>{flight.origin.city} to {flight.destination.city}</h1></header>
      <FlightTicket flight={flight} hideAction />

      <div className="detail-grid">
        <div>
          <dl className="facts">
            <div><dt>Departs</dt><dd>{fmtDateTime(flight.departure_time)}</dd></div>
            <div><dt>Arrives</dt><dd>{fmtDateTime(flight.arrival_time)}</dd></div>
            <div><dt>Aircraft</dt><dd>{flight.aircraft || "To be confirmed"}</dd></div>
            <div><dt>Seats</dt><dd>{flight.available_seats} of {flight.total_seats} available</dd></div>
          </dl>
          <LiveStatus flightId={flight.id} />
        </div>

        {!bookable ? (
          <Empty title={departed ? "This flight has departed" : flight.status === "cancelled" ? "This flight was cancelled" : "This flight is sold out"}
                 action={<Link to="/flights" className="btn btn-primary">Find another flight</Link>}>
            You can't book it, but other flights on this route may still have seats.
          </Empty>
        ) : (
          <form className="booking" onSubmit={submit} noValidate>
            <h2>Passengers</h2>
            {passengers.map((p, i) => (
              <fieldset key={i} className="pax-row">
                <legend>Passenger {i + 1}</legend>
                <div className="grid-pax">
                  <Field label="Full name" htmlFor={`pn${i}`} error={errors.passengers[i]?.name}>
                    <input id={`pn${i}`} value={p.name} onChange={setPax(i, "name")} autoComplete="off" />
                  </Field>
                  <Field label="Age" htmlFor={`pa${i}`} error={errors.passengers[i]?.age}>
                    <input id={`pa${i}`} type="number" min="0" max="120" value={p.age} onChange={setPax(i, "age")} />
                  </Field>
                  {passengers.length > 1 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setPassengers((ps) => ps.filter((_, j) => j !== i))}>Remove</button>
                  )}
                </div>
              </fieldset>
            ))}
            {passengers.length < maxPax && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPassengers((ps) => [...ps, blankPax()])}>Add passenger</button>
            )}

            <h2>Payment</h2>
            <div className="methods" role="radiogroup" aria-label="Payment method">
              {[["card", "Card"], ["upi", "UPI"], ["netbanking", "Net banking"]].map(([v, l]) => (
                <label key={v} className={`method${pay.method === v ? " is-on" : ""}`}>
                  <input type="radio" name="method" value={v} checked={pay.method === v} onChange={setPayField("method")} />{l}
                </label>
              ))}
            </div>
            {pay.method === "card" && (
              <>
                <Field label="Card number" htmlFor="cn" error={errors.pay.card_number} hint="Demo only: a card ending in 0002 is declined.">
                  <input id="cn" inputMode="numeric" autoComplete="off" value={pay.card_number} onChange={setPayField("card_number")} placeholder="4242 4242 4242 4242" />
                </Field>
                <div className="grid-2">
                  <Field label="Expiry (MM/YY)" htmlFor="ex" error={errors.pay.expiry}>
                    <input id="ex" value={pay.expiry} onChange={setPayField("expiry")} placeholder="08/29" maxLength={5} />
                  </Field>
                  <Field label="CVV" htmlFor="cv" error={errors.pay.cvv}>
                    <input id="cv" inputMode="numeric" type="password" value={pay.cvv} onChange={setPayField("cvv")} maxLength={4} autoComplete="off" />
                  </Field>
                </div>
              </>
            )}
            {pay.method === "upi" && (
              <Field label="UPI ID" htmlFor="upi" error={errors.pay.upi_id}>
                <input id="upi" value={pay.upi_id} onChange={setPayField("upi_id")} placeholder="name@bank" />
              </Field>
            )}
            {pay.method === "netbanking" && (
              <Field label="Bank" htmlFor="bank">
                <select id="bank" value={pay.bank} onChange={setPayField("bank")}>
                  {["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Federal Bank"].map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            )}

            <div className="summary">
              <span>{passengers.length} × {fmtINR(flight.price)}</span>
              <strong>{fmtINR(total)}</strong>
            </div>
            <Alert>{error}</Alert>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Processing payment…" : `Pay ${fmtINR(total)} and book`}</button>
            <p className="muted small">Payment is simulated. No real card details are stored or sent.</p>
          </form>
        )}
      </div>
    </>
  );
}
