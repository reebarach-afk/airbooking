import { useCallback, useEffect, useState } from "react";
import api, { errorMessage, fetchAll } from "../../api/client";
import { Alert, Empty, Loading } from "../../components/ui";
import { fmtDate } from "../../lib";

const TABS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"]];

export default function AdminUsers() {
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAll("/admin/users/", { ...(tab && { approval_status: tab }), ...(search && { search }) }));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, search]);

  async function review(user, action) {
    setBusyId(user.id);
    setNotice("");
    try {
      await api.post(`/admin/users/${user.id}/${action}/`);
      setNotice(action === "approve" ? `${user.email} approved. An activation email is on its way.` : `${user.email} rejected.`);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="page-head"><h1>Users</h1></header>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={label} role="tab" aria-selected={tab === k} className={`tab${tab === k ? " is-on" : ""}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <input type="search" className="search" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
      </div>
      <Alert kind="success" onClose={() => setNotice("")}>{notice}</Alert>
      <Alert onClose={() => setError("")}>{error}</Alert>
      {loading ? <Loading label="Loading users" /> : rows.length === 0 ? (
        <Empty title={tab === "pending" ? "No accounts waiting for approval" : "No users found"}>
          {tab === "pending" ? "New registrations will show up here." : "Try a different filter or search."}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td data-label="Name">{u.full_name}{u.role === "admin" && <em className="role-tag role-tag-dark">Admin</em>}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Registered">{fmtDate(u.date_joined)}</td>
                  <td data-label="Status"><span className={`badge badge-${u.approval_status}`}>{u.approval_status}</span></td>
                  <td className="actions">
                    {u.role !== "admin" && u.approval_status !== "approved" && (
                      <button className="btn btn-primary btn-sm" disabled={busyId === u.id} onClick={() => review(u, "approve")}>Approve</button>
                    )}
                    {u.role !== "admin" && u.approval_status !== "rejected" && (
                      <button className="btn btn-danger-outline btn-sm" disabled={busyId === u.id} onClick={() => review(u, "reject")}>
                        {u.approval_status === "approved" ? "Revoke" : "Reject"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
