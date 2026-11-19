import { useEffect, useState } from "react";
import api from "../api/client";

let cache = null;

/** Airports rarely change, so load once per session. */
export function useAirports() {
  const [airports, setAirports] = useState(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api.get("/flights/airports/").then((res) => {
      cache = res.data;
      setAirports(res.data);
    }).catch(() => {});
  }, []);
  return airports;
}
