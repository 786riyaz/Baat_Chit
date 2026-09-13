"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProtectedRoute from "../../components/common/ProtectedRoute";
import StatsGrid from "../../components/admin/StatsGrid";
import UsersTable from "../../components/admin/UsersTable";
import ThemeToggle from "../../components/common/ThemeToggle";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import {
  getAdminStats,
  listAllUsers,
  listPendingUsers,
  approveUser,
  suspendUser,
  rejectUser,
  revokeApproval
} from "../../services/admin";

function AdminContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user.role !== "admin") {
      router.replace("/chat");
    }
  }, [user.role, router]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsData, usersData] = await Promise.all([
        getAdminStats(),
        tab === "pending" ? listPendingUsers() : listAllUsers(search)
      ]);
      setStats(statsData);
      setUsers(usersData);
    } catch (err) {
      showToast(err.message || "Unable to load admin data", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleAction(actionFn, userId) {
    try {
      await actionFn(userId);
      showToast("User updated", "success");
      loadData();
    } catch (err) {
      showToast(err.message || "Unable to update user", "error");
    }
  }

  if (user.role !== "admin") return null;

  return (
    <div className="profile-shell">
      <div className="profile-card" style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/chat" className="back-link" style={{ marginBottom: 0 }}>&larr; Back to chat</Link>
          <ThemeToggle className="icon-btn-outline" />
        </div>
        <h1 style={{ fontSize: "1.3rem" }}>Admin dashboard</h1>

        {stats && <StatsGrid stats={stats} />}

        <div className="sidebar-tabs" style={{ padding: 0, marginBottom: 12 }}>
          <button
            className={tab === "pending" ? "active" : ""}
            style={{ color: tab === "pending" ? "var(--ink)" : "var(--text-muted)" }}
            onClick={() => setTab("pending")}
          >
            Pending approvals
          </button>
          <button
            className={tab === "all" ? "active" : ""}
            style={{ color: tab === "all" ? "var(--ink)" : "var(--text-muted)" }}
            onClick={() => setTab("all")}
          >
            All users
          </button>
        </div>

        {tab === "all" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadData();
            }}
            style={{ display: "flex", gap: 8, marginBottom: 12 }}
          >
            <input
              type="text"
              placeholder="Search name, email, or phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
            />
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>
        )}

        {loading ? (
          <div className="page-loader" style={{ height: 120 }}>Loading...</div>
        ) : (
          <UsersTable
            users={users}
            onApprove={(id) => handleAction(approveUser, id)}
            onSuspend={(id) => handleAction(suspendUser, id)}
            onReject={(id) => handleAction(rejectUser, id)}
            onRevoke={(id) => handleAction(revokeApproval, id)}
          />
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminContent />
    </ProtectedRoute>
  );
}
