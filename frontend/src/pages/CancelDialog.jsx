import { useState } from "react";
import { errorMessage } from "../api/client";
import { Alert, Modal } from "../components/ui";
import { useTrips } from "../context/TripsContext";
import { fmtDate, fmtINR } from "../lib";

export default function CancelDialog({ booking, onClose, onDone }) {
  const { cancelBooking } = useTrips();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const f = booking.flight;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await cancelBooking(booking.id);
      onDone?.();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Cancel this booking?" onClose={onClose}>
      <p>
        {f.origin.city} to {f.destination.city} on {fmtDate(f.departure_time)}, reference <strong>{booking.booking_ref}</strong>.
        Your {booking.seats} seat{booking.seats > 1 ? "s" : ""} will be released and {fmtINR(booking.total_price)} refunded.
      </p>
      <Alert>{error}</Alert>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose} disabled={busy}>Keep booking</button>
        <button className="btn btn-danger" onClick={confirm} disabled={busy}>{busy ? "Cancelling…" : "Cancel booking"}</button>
      </div>
    </Modal>
  );
}
