import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import BoardingPass from "../components/BoardingPass";
import { Empty, Loading } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useTrips } from "../context/TripsContext";
import { fmtINR, isPast, todayISO } from "../lib";
import { useAirports } from "./useAirports";

export default function Dashboard() {
  const { user } = useAuth();
  const { items, loading, error, refresh } = useTrips();
  const navigate = useNavigate();
  const airports = useAirports();

  const stats = useMemo(() => {
    const confirmed = items.filter((b) => b.status === "confirmed");
    const upcoming = confirmed.filter((b) => !isPast(b.flight.departure_time))
      .sort((a, b) => new Date(a.flight.departure_time) - new Date(b.flight.departure_time));
    return {
      upcoming,
      booked: confirmed.length,
      spent: confirmed.reduce((s, b) => s + Number(b.total_price), 0),
    };
  }, [items]);

  function quickSearch(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const k of ["origin", "destination", "date"]) if (fd.get(k)) params.set(k, fd.get(k));
    navigate(`/flights?${params}`);
  }

  return (
    <>
      <header className="page-head">
        <h1>Welcome back, {user.first_name}</h1>
        <p className="muted">Here's what's coming up.</p>
      </header>

      <form className="quick" onSubmit={quickSearch}>
        <h2>Where to next?</h2>
        <div className="quick-fields">
          <label>From
            <select name="origin" defaultValue="">
              <option value="">Anywhere</option>
              {airports.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
            </select>
          </label>
          <label>To
            <select name="destination" defaultValue="">
              <option value="">Anywhere</option>
              {airports.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
            </select>
          </label>
          <label>Date
            <input type="date" name="date" min={todayISO()} />
          </label>
          <button className="btn btn-primary">Search flights</button>
        </div>
      </form>

      <div className="figures" role="list">
        <div role="listitem"><span className="figure">{stats.upcoming.length}</span><span className="figure-label">Upcoming trips</span></div>
        <div role="listitem"><span className="figure">{stats.booked}</span><span className="figure-label">Bookings made</span></div>
        <div role="listitem"><span className="figure">{fmtINR(stats.spent)}</span><span className="figure-label">Total spent</span></div>
      </div>

      <section>
        <div className="section-head">
          <h2>Next trip</h2>
          <Link to="/trips" className="link">All trips</Link>
        </div>
        {loading && <Loading label="Loading your trips" />}
        {error && <p className="field-error">{error} <button className="link" onClick={refresh}>Try again</button></p>}
        {!loading && !error && stats.upcoming.length === 0 && (
          <Empty title="No upcoming trips" action={<Link to="/flights" className="btn btn-primary">Find a flight</Link>}>
            Book a flight and it will show up here with live status updates.
          </Empty>
        )}
        {stats.upcoming.slice(0, 2).map((b) => <BoardingPass key={b.id} booking={b} />)}
      </section>
    </>
  );
}
