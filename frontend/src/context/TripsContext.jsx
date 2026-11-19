import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import api, { fetchAll } from "../api/client";
import { useAuth } from "./AuthContext";

/** Booking state for the signed-in traveller: one source of truth for dashboard, My Trips and detail pages. */
const TripsContext = createContext(null);
export const useTrips = () => useContext(TripsContext);

const initial = { items: [], loading: false, loaded: false, error: "" };

function reducer(state, action) {
  switch (action.type) {
    case "loading": return { ...state, loading: true, error: "" };
    case "loaded": return { items: action.items, loading: false, loaded: true, error: "" };
    case "failed": return { ...state, loading: false, error: action.error };
    case "added": return { ...state, items: [action.booking, ...state.items] };
    case "updated": return { ...state, items: state.items.map((b) => (b.id === action.booking.id ? action.booking : b)) };
    case "reset": return initial;
    default: return state;
  }
}

export function TripsProvider({ children }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initial);

  const refresh = useCallback(async () => {
    dispatch({ type: "loading" });
    try {
      dispatch({ type: "loaded", items: await fetchAll("/bookings/") });
    } catch {
      dispatch({ type: "failed", error: "Couldn't load your trips." });
    }
  }, []);

  useEffect(() => {
    if (user && user.role === "user") refresh();
    else dispatch({ type: "reset" });
  }, [user, refresh]);

  const createBooking = useCallback(async (payload) => {
    const { data } = await api.post("/bookings/", payload);
    dispatch({ type: "added", booking: data });
    return data;
  }, []);

  const cancelBooking = useCallback(async (id) => {
    const { data } = await api.post(`/bookings/${id}/cancel/`);
    dispatch({ type: "updated", booking: data });
    return data;
  }, []);

  const value = useMemo(() => ({ ...state, refresh, createBooking, cancelBooking }), [state, refresh, createBooking, cancelBooking]);
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}
