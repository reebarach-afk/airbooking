import { Link } from "react-router-dom";
import { fmtDate, fmtDuration, fmtINR, fmtTime } from "../lib";
import StatusBadge from "./StatusBadge";
import { PlaneIcon } from "./ui";

/** A booking rendered as a boarding pass. `children` render in the stub (actions). */
export default function BoardingPass({ booking, children, linkToDetail = true }) {
  const f = booking.flight;
  const cancelled = booking.status === "cancelled";
  return (
    <article className={`ticket pass${cancelled ? " is-cancelled" : ""}`}>
      <div className="stripe" aria-hidden="true" />
      <div className="ticket-main">
        <div className="ticket-meta">
          <strong>{f.airline}</strong>
          <span>{f.flight_number}</span>
          <span>{fmtDate(f.departure_time)}</span>
          {cancelled ? <span className="badge badge-cancelled">Booking cancelled</span> : <StatusBadge status={f.status} delay={f.delay_minutes} />}
        </div>
        <div className="route">
          <div className="route-end">
            <span className="route-time">{fmtTime(f.departure_time)}</span>
            <span className="route-code">{f.origin.code}</span>
            <span className="route-city">{f.origin.city}</span>
          </div>
          <div className="route-line"><span className="route-duration">{fmtDuration(f.duration_minutes)}</span><span className="route-track"><PlaneIcon size={16} /></span></div>
          <div className="route-end route-end-right">
            <span className="route-time">{fmtTime(f.arrival_time)}</span>
            <span className="route-code">{f.destination.code}</span>
            <span className="route-city">{f.destination.city}</span>
          </div>
        </div>
        <ul className="pax">
          {booking.passengers.map((p, i) => (
            <li key={i}>{p.name}<span className="muted"> ({p.age})</span></li>
          ))}
        </ul>
      </div>
      <div className="ticket-stub">
        <div>
          <span className="per">Booking reference</span>
          <span className="ref">{booking.booking_ref}</span>
        </div>
        <div>
          <span className="price price-sm">{fmtINR(booking.total_price)}</span>
          <span className="per">{booking.seats} seat{booking.seats > 1 ? "s" : ""}, {booking.payment_status_display.toLowerCase()}</span>
        </div>
        {linkToDetail && <Link to={`/trips/${booking.id}`} className="btn btn-outline btn-sm">View trip</Link>}
        {children}
      </div>
    </article>
  );
}
