import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../../api/client";
import { Alert, Loading } from "../../components/ui";
import { fmtINR, fmtShortDate } from "../../lib";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/stats/").then((r) => setStats(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Loading label="Loading overview" />;

  const maxDay = Math.max(1, ...stats.bookings_last_7_days.map((d) => d.bookings));
  const maxRoute = Math.max(1, ...stats.top_routes.map((r) => r.bookings));

  return (
    <>
      <header className="page-head"><h1>Overview</h1><p className="muted">Bookings, revenue and approvals at a glance.</p></header>

      {stats.users.pending > 0 && (
        <div className="notice">
          <span><strong>{stats.users.pending}</strong> account{stats.users.pending > 1 ? "s are" : " is"} waiting for approval.</span>
          <Link to="/admin/users" className="btn btn-primary btn-sm">Review accounts</Link>
        </div>
      )}

      <div className="figures figures-5" role="list">
        <div role="listitem"><span className="figure">{stats.bookings.confirmed}</span><span className="figure-label">Confirmed bookings</span></div>
        <div role="listitem"><span className="figure">{stats.bookings.seats_sold}</span><span className="figure-label">Seats sold</span></div>
        <div role="listitem"><span className="figure">{fmtINR(stats.bookings.revenue)}</span><span className="figure-label">Revenue</span></div>
        <div role="listitem"><span className="figure">{stats.occupancy_percent}%</span><span className="figure-label">Seat occupancy</span></div>
        <div role="listitem"><span className="figure">{stats.bookings.cancelled}</span><span className="figure-label">Cancellations</span></div>
      </div>

      <div className="two-col">
        <section>
          <h2>Bookings, last 7 days</h2>
          <div className="bars" role="img" aria-label="Bookings per day for the last 7 days">
            {stats.bookings_last_7_days.map((d) => (
              <div className="bar-col" key={d.date}>
                <span className="bar-val">{d.bookings}</span>
                <span className="bar" style={{ height: `${(d.bookings / maxDay) * 100}%` }} />
                <span className="bar-label">{fmtShortDate(d.date)}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>Busiest routes</h2>
          {stats.top_routes.length === 0 ? <p className="muted">No bookings yet.</p> : (
            <ul className="hbars">
              {stats.top_routes.map((r) => (
                <li key={r.route}>
                  <span className="hbar-label">{r.route}</span>
                  <span className="hbar-track"><span className="hbar" style={{ width: `${(r.bookings / maxRoute) * 100}%` }} /></span>
                  <span className="hbar-val">{r.bookings}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2>Flights and accounts</h2>
        <dl className="facts facts-wide">
          <div><dt>Flights scheduled</dt><dd>{stats.flights.total}</dd></div>
          <div><dt>On time</dt><dd>{stats.flights.on_time}</dd></div>
          <div><dt>Delayed</dt><dd>{stats.flights.delayed}</dd></div>
          <div><dt>Cancelled</dt><dd>{stats.flights.cancelled}</dd></div>
          <div><dt>Approved users</dt><dd>{stats.users.approved}</dd></div>
          <div><dt>Rejected users</dt><dd>{stats.users.rejected}</dd></div>
        </dl>
      </section>
    </>
  );
}
