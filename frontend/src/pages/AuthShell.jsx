import { PlaneIcon } from "../components/ui";

export default function AuthShell({ title, intro, children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="stripe stripe-thick" aria-hidden="true" />
        <div className="auth-side-body">
          <span className="brand brand-light"><span className="brand-mark"><PlaneIcon size={16} /></span>AirBooking</span>
          <h1>Book flights once your account is approved.</h1>
          <p>Register, wait for an admin to approve you, then search, book and track every trip in one place.</p>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <h2>{title}</h2>
          {intro && <p className="muted">{intro}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}
