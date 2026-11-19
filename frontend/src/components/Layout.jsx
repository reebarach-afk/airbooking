import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PlaneIcon } from "./ui";

const USER_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/flights", label: "Find flights" },
  { to: "/trips", label: "My trips" },
];
const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/flights", label: "Flights" },
  { to: "/admin/bookings", label: "Bookings" },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="AirBooking home">
            <span className="brand-mark"><PlaneIcon size={16} /></span>
            <span>AirBooking</span>
          </NavLink>
          <button
            type="button" className="nav-toggle" aria-expanded={open} aria-controls="main-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
          <nav id="main-nav" className={`nav${open ? " nav-open" : ""}`} aria-label="Main" key={location.pathname}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="nav-link" onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <div className="nav-user">
              <span className="nav-name">{user?.full_name || user?.email}{isAdmin && <em className="role-tag">Admin</em>}</span>
              <button type="button" className="btn btn-ghost-light btn-sm" onClick={logout}>Sign out</button>
            </div>
          </nav>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">AirBooking demo for YUAI Soft Solutions. Flight data is fictional.</footer>
    </div>
  );
}
