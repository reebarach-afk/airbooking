import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { Alert, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import AuthShell from "./AuthShell";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (!form.password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      const user = await login(form.email.trim(), form.password);
      const dest = user.role === "admin" ? "/admin" : location.state?.from || "/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? errorMessage(err, "Incorrect email or password.") : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Sign in" intro="Use the email and password you registered with.">
      <form onSubmit={onSubmit} noValidate>
        <Alert>{error}</Alert>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={set("password")} />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="auth-alt">New here? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}
