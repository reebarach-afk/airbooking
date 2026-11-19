import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, fieldErrors } from "../api/client";
import { Alert, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import AuthShell from "./AuthShell";

const empty = { first_name: "", last_name: "", email: "", phone: "", password: "", confirm_password: "" };

function validate(f) {
  const e = {};
  if (f.first_name.trim().length < 2) e.first_name = "Enter your first name.";
  if (f.last_name.trim().length < 1) e.last_name = "Enter your last name.";
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email address.";
  if (f.phone && !/^\+?\d{10,14}$/.test(f.phone)) e.phone = "Use 10 to 14 digits, optionally starting with +.";
  if (f.password.length < 8) e.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Include at least one letter and one number.";
  if (f.confirm_password !== f.password) e.confirm_password = "Passwords don't match.";
  return e;
}

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = validate(form);
    setErrors(next);
    setError("");
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await register({ ...form, email: form.email.trim().toLowerCase() });
      setDone(form.email.trim());
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setError(Object.keys(fe).length ? "Please fix the highlighted fields." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Registration received">
        <Alert kind="success">Your account is now pending admin approval.</Alert>
        <p>We'll email <strong>{done}</strong> as soon as an admin activates your account. After that you can sign in and book flights.</p>
        <Link to="/login" className="btn btn-primary">Go to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" intro="An admin reviews every new account before it can sign in.">
      <form onSubmit={onSubmit} noValidate>
        <Alert>{error}</Alert>
        <div className="grid-2">
          <Field label="First name" htmlFor="first_name" error={errors.first_name}>
            <input id="first_name" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} />
          </Field>
          <Field label="Last name" htmlFor="last_name" error={errors.last_name}>
            <input id="last_name" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} />
          </Field>
        </div>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={errors.phone}>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="+919876543210" />
        </Field>
        <div className="grid-2">
          <Field label="Password" htmlFor="password" error={errors.password} hint="8+ characters with a letter and a number.">
            <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm_password" error={errors.confirm_password}>
            <input id="confirm_password" type="password" autoComplete="new-password" value={form.confirm_password} onChange={set("confirm_password")} />
          </Field>
        </div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="auth-alt">Already registered? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}
