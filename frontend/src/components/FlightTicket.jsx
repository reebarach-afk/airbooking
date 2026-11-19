import { Link } from "react-router-dom";
import { fmtDate, fmtDuration, fmtINR, fmtTime } from "../lib";
import StatusBadge from "./StatusBadge";
import { PlaneIcon } from "./ui";

/** A flight rendered as a boarding pass: route on the left, price and action on the perforated stub. */
export default function FlightTicket({ flight, action, compact, hideAction }) {
  const soldOut = flight.available_seats === 0;
  const low = !soldOut && flight.available_seats <= 10;
  return (
    <article className={`ticket${compact ? " ticket-compact" : ""}`}>
      <div className="ticket-main">
        <div className="ticket-meta">
          <strong>{flight.airline}</strong>
          <span>{flight.flight_number}</span>
          <span>{fmtDate(flight.departure_time)}</span>
          <StatusBadge status={flight.status} delay={flight.delay_minutes} />
        </div>
        <div className="route">
          <div className="route-end">
            <span className="route-time">{fmtTime(flight.departure_time)}</span>
            <span className="route-code">{flight.origin.code}</span>
            <span className="route-city">{flight.origin.city}</span>
          </div>
          <div className="route-line" aria-label={`Duration ${fmtDuration(flight.duration_minutes)}`}>
            <span className="route-duration">{fmtDuration(flight.duration_minutes)}</span>
            <span className="route-track"><PlaneIcon size={16} /></span>
          </div>
          <div className="route-end route-end-right">
            <span className="route-time">{fmtTime(flight.arrival_time)}</span>
            <span className="route-code">{flight.destination.code}</span>
            <span className="route-city">{flight.destination.city}</span>
          </div>
        </div>
      </div>
      <div className="ticket-stub">
        <div>
          <span className="price">{fmtINR(flight.price)}</span>
          <span className="per">per person</span>
        </div>
        <span className={`seats${low ? " seats-low" : ""}${soldOut ? " seats-out" : ""}`}>
          {soldOut ? "Sold out" : low ? `Only ${flight.available_seats} seats left` : `${flight.available_seats} seats available`}
        </span>
        {hideAction ? null : action ?? (
          <Link to={`/flights/${flight.id}`} className={`btn btn-sm ${soldOut || flight.status === "cancelled" ? "btn-outline" : "btn-primary"}`}>
            {soldOut || flight.status === "cancelled" ? "View details" : "Select flight"}
          </Link>
        )}
      </div>
    </article>
  );
}
