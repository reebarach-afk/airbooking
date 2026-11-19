import { useEffect, useState } from "react";
import { fetchAll, errorMessage } from "../../api/client";
import { Alert, Empty, Loading } from "../../components/ui";
import { fmtDateTime, fmtINR } from "../../lib";

export default function AdminBookings() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    fetchAll("/admin/bookings/", status ? { status } : {}).then(setRows).catch((e) => setError(errorMessage(e)));
  }, [status]);

  return (
    <>
      <header className="page-head"><h1>Bookings</h1></header>
      <div className="toolbar">
        <label className="inline">Show
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All bookings</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <Alert>{error}</Alert>
      {!rows ? <Loading label="Loading bookings" /> : rows.length === 0 ? <Empty title="No bookings yet">Bookings made by travellers will appear here.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Reference</th><th>Traveller</th><th>Flight</th><th>Seats</th><th>Total</th><th>Status</th><th>Booked</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td data-label="Reference"><strong>{b.booking_ref}</strong></td>
                  <td data-label="Traveller">{b.user_email}</td>
                  <td data-label="Flight">{b.flight.flight_number}, {b.flight.origin.code} to {b.flight.destination.code}</td>
                  <td data-label="Seats">{b.seats}</td>
                  <td data-label="Total">{fmtINR(b.total_price)}</td>
                  <td data-label="Status"><span className={`badge badge-${b.status}`}>{b.status_display}</span></td>
                  <td data-label="Booked">{fmtDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
