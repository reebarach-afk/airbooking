import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { ProtectedRoute, PublicOnlyRoute } from "./components/routes";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FlightSearch from "./pages/FlightSearch";
import FlightDetail from "./pages/FlightDetail";
import MyTrips from "./pages/MyTrips";
import TripDetail from "./pages/TripDetail";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminFlights from "./pages/admin/AdminFlights";
import AdminBookings from "./pages/admin/AdminBookings";
import NotFound from "./pages/NotFound";

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<Layout />}>
        <Route element={<ProtectedRoute role="user" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/flights" element={<FlightSearch />} />
          <Route path="/flights/:id" element={<FlightDetail />} />
          <Route path="/trips" element={<MyTrips />} />
          <Route path="/trips/:id" element={<TripDetail />} />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/flights" element={<AdminFlights />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
