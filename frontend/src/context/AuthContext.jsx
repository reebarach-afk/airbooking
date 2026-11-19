import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { tokens } from "../api/client";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access));

  // Restore the session on page load.
  useEffect(() => {
    if (!tokens.access) return;
    api.get("/auth/me/")
      .then((res) => setUser(res.data))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  // The interceptor tells us when the refresh token is no longer valid.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login/", { email, password });
    tokens.set(data);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback((payload) => api.post("/auth/register/", payload), []);

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isAdmin: user?.role === "admin" }),
    [user, loading, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
