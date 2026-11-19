import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BoardingPass from "../components/BoardingPass";
import { Alert, Empty, Loading } from "../components/ui";
import { useTrips } from "../context/TripsContext";
import { errorMessage } from "../api/client";
import { isPast } from "../lib";
import CancelDialog from "./CancelDialog";

const TABS = [["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"]];

export default function MyTrips() {
  const { items, loading, error, refresh } = useTrips();
  const [tab, setTab] = useState("upcoming");
  const [toCancel, setToCancel] = useState(null);

  const groups = useMemo(() => {
    const sorted = [...items].sort((a, b) => new Date(a.flight.departure_time) - new Date(b.flight.departure_time));
    return {
      upcoming: sorted.filter((b) => b.status === "confirmed" && !isPast(b.flight.departure_time)),
      past: sorted.filter((b) => b.status === "confirmed" && isPast(b.flight.departure_time)).reverse(),
      cancelled: sorted.filter((b) => b.status === "cancelled").reverse(),
    };
  }, [items]);

  const list = groups[tab];
  return (
    <>
      <header className="page-head"><h1>My trips</h1></header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? " is-on" : ""}`} onClick={() => setTab(k)}>
            {label} <span className="tab-count">{groups[k].length}</span>
          </button>
        ))}
      </div>
      {loading && !items.length && <Loading label="Loading your trips" />}
      {error && <Alert>{error} <button className="link" onClick={refresh}>Try again</button></Alert>}
      {!loading && !error && list.length === 0 && (
        <Empty title={`No ${tab} trips`} action={tab === "upcoming" ? <Link to="/flights" className="btn btn-primary">Find a flight</Link> : null}>
          {tab === "upcoming" ? "Your confirmed bookings will appear here." : tab === "past" ? "Trips you've already taken will appear here." : "Cancelled bookings will appear here."}
        </Empty>
      )}
      <div className="stack">
        {list.map((b) => (
          <BoardingPass key={b.id} booking={b}>
            {b.can_cancel && <button className="btn btn-danger-outline btn-sm" onClick={() => setToCancel(b)}>Cancel booking</button>}
          </BoardingPass>
        ))}
      </div>
      {toCancel && <CancelDialog booking={toCancel} onClose={() => setToCancel(null)} />}
    </>
  );
}
