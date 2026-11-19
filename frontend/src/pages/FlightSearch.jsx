import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import FlightTicket from "../components/FlightTicket";
import { Alert, Empty, Loading } from "../components/ui";
import { todayISO } from "../lib";
import { useAirports } from "./useAirports";

const DEFAULTS = { origin: "", destination: "", date: "", airline: "", max_price: "", ordering: "departure_time", available_only: "true" };

export default function FlightSearch() {
  const airports = useAirports();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({ ...DEFAULTS, ...Object.fromEntries(params) });
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const page = Number(params.get("page") || 1);

  // Fetch whenever the URL (the single source of truth for filters) changes.
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const query = { available_only: "true", ordering: "departure_time", ...Object.fromEntries(params) };
    api.get("/flights/search/", { params: query })
      .then((res) => !cancelled && setState({ loading: false, error: "", data: res.data }))
      .catch((err) => !cancelled && setState({ loading: false, error: errorMessage(err), data: null }));
    return () => { cancelled = true; };
  }, [params]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? String(e.target.checked) : e.target.value }));

  function submit(e) {
    e?.preventDefault();
    const next = new URLSearchParams();
    Object.entries(form).forEach(([k, v]) => v !== "" && next.set(k, v));
    setParams(next);
  }
  function reset() {
    setForm(DEFAULTS);
    setParams(new URLSearchParams());
  }
  function swap() {
    setForm((f) => ({ ...f, origin: f.destination, destination: f.origin }));
  }
  function goPage(p) {
    const next = new URLSearchParams(params);
    next.set("page", p);
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const { loading, error, data } = state;
  const sameRoute = form.origin && form.origin === form.destination;

  return (
    <>
      <header className="page-head">
        <h1>Find flights</h1>
      </header>
      <div className="search-layout">
        <form className="filters" onSubmit={submit}>
          <details className="filters-fold" open={window.matchMedia("(min-width: 901px)").matches}>
            <summary>Filters</summary>
            <label>From
              <select value={form.origin} onChange={set("origin")}>
                <option value="">Any airport</option>
                {airports.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-outline btn-sm swap" onClick={swap} aria-label="Swap origin and destination">Swap</button>
            <label>To
              <select value={form.destination} onChange={set("destination")}>
                <option value="">Any airport</option>
                {airports.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
              </select>
            </label>
            {sameRoute && <p className="field-error">Origin and destination are the same.</p>}
            <label>Date
              <input type="date" min={todayISO()} value={form.date} onChange={set("date")} />
            </label>
            <label>Airline
              <input value={form.airline} onChange={set("airline")} placeholder="e.g. IndiGo" />
            </label>
            <label>Max price per person (₹)
              <input type="number" min="0" step="500" value={form.max_price} onChange={set("max_price")} placeholder="No limit" />
            </label>
            <label>Sort by
              <select value={form.ordering} onChange={set("ordering")}>
                <option value="departure_time">Earliest departure</option>
                <option value="price">Lowest price</option>
                <option value="-price">Highest price</option>
                <option value="arrival_time">Earliest arrival</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.available_only === "true"} onChange={set("available_only")} />
              Only flights with seats available
            </label>
            <div className="filter-actions">
              <button className="btn btn-primary" disabled={sameRoute}>Search</button>
              <button type="button" className="btn btn-outline" onClick={reset}>Clear</button>
            </div>
          </details>
        </form>

        <section aria-live="polite">
          {loading && <Loading label="Searching flights" />}
          <Alert>{error}</Alert>
          {!loading && data && (
            <>
              <p className="result-count">{data.count} flight{data.count === 1 ? "" : "s"} found</p>
              {data.count === 0 && (
                <Empty title="No flights match" action={<button className="btn btn-outline" onClick={reset}>Clear filters</button>}>
                  Try another date, remove the price limit or search from a different airport.
                </Empty>
              )}
              <div className="stack">
                {data.results.map((f) => <FlightTicket key={f.id} flight={f} />)}
              </div>
              {(data.previous || data.next) && (
                <nav className="pager" aria-label="Pagination">
                  <button className="btn btn-outline btn-sm" disabled={!data.previous} onClick={() => goPage(page - 1)}>Previous</button>
                  <span>Page {page} of {Math.ceil(data.count / 20)}</span>
                  <button className="btn btn-outline btn-sm" disabled={!data.next} onClick={() => goPage(page + 1)}>Next</button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
