import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const ACCESS = "ab_access";
const REFRESH = "ab_refresh";

export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

// One shared refresh request, so parallel 401s don't each burn a refresh token.
let refreshing = null;
function refreshAccessToken() {
  if (!tokens.refresh) return Promise.reject(new Error("No refresh token"));
  refreshing ??= axios
    .post(`${BASE_URL}/auth/token/refresh/`, { refresh: tokens.refresh })
    .then((res) => { tokens.set(res.data); return res.data.access; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith("/auth/login") || original?.url?.startsWith("/auth/register");
    if (error.response?.status === 401 && original && !isAuthCall) {
      if (!original._retry && tokens.refresh) {
        original._retry = true;
        try {
          const access = await refreshAccessToken();
          original.headers.Authorization = `Bearer ${access}`;
          return api(original);
        } catch {
          /* fall through to session expiry */
        }
      }
      if (tokens.access) {
        tokens.clear();
        window.dispatchEvent(new Event("auth:expired"));
      }
    }
    return Promise.reject(error);
  }
);

/** Turn any axios/DRF error into one readable sentence. */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err.response) return "Can't reach the server. Check your connection and that the API is running.";
  const data = err.response.data;
  if (data?.detail) return data.detail;
  if (typeof data === "string" && data.length < 200) return data;
  return fallback;
}

/** Field-level errors from DRF as { field: "message" }. */
export function fieldErrors(err) {
  const errors = err.response?.data?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
  return Object.fromEntries(
    Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : typeof v === "string" ? v : "Invalid value"])
  );
}

/** Follow DRF pagination and return every row (used for small admin/user lists). */
export async function fetchAll(url, params = {}) {
  let page = 1;
  const rows = [];
  for (;;) {
    const { data } = await api.get(url, { params: { ...params, page } });
    if (!data.results) return data;
    rows.push(...data.results);
    if (!data.next || page >= 20) return rows;
    page += 1;
  }
}

export default api;
