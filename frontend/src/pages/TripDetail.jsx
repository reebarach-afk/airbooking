import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import BoardingPass from "../components/BoardingPass";
import LiveStatus from "../components/LiveStatus";
import { Alert, Empty, Loading } from "../components/ui";
import { useTrips } from "../context/TripsContext";
import { fmtDateTime, fmtINR } from "../lib";
import CancelDialog from "./CancelDialog";

export default function TripDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { items } = useTrips();
  const [fetched, setFetched] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const booking = items.find((b) => String(b.id) === id) ?? fetched;

  useEffect(() => {
    if (items.find((b) => String(b.id) === id)) return;
    api.get(`/bookings/${id}/`).then((r) => setFetched(r.data)).catch((e) => setError(errorMessage(e, "Booking not found.")));
  }, [id, items]);

  if (error) return <Empty title="Booking not found" action={<Link to="/trips" className="btn btn-primary">Back to my trips</Link>}>{error}</Empty>;
  if (!booking) return <Loading label="Loading trip" />;

  return (
    <>
      <Link to="/trips" className="back no-print">Back to my trips</Link>
      {location.state?.justBooked && (
        <Alert kind="success">Booking confirmed and paid. Your reference is {booking.booking_ref}.</Alert>
      )}
      <header className="page-head"><h1>{booking.flight.origin.city} to {booking.flight.destination.city}</h1></header>
      <BoardingPass booking={booking} linkToDetail={false}>
        <button className="btn btn-outline btn-sm no-print" onClick={() => window.print()}>Print ticket</button>
        {booking.can_cancel && <button className="btn btn-danger-outline btn-sm no-print" onClick={() => setCancelling(true)}>Cancel booking</button>}
      </BoardingPass>

      <div className="detail-grid">
        <dl className="facts">
          <div><dt>Booked on</dt><dd>{fmtDateTime(booking.created_at)}</dd></div>
          <div><dt>Payment</dt><dd>{booking.payment_status_display} by {booking.payment_method}, {fmtINR(booking.total_price)}</dd></div>
          <div><dt>Payment reference</dt><dd>{booking.payment_reference}</dd></div>
          {booking.cancelled_at && <div><dt>Cancelled on</dt><dd>{fmtDateTime(booking.cancelled_at)}</dd></div>}
        </dl>
        <div className="no-print"><LiveStatus flightId={booking.flight.id} /></div>
      </div>
      {cancelling && <CancelDialog booking={booking} onClose={() => setCancelling(false)} />}
    </>
  );
}
