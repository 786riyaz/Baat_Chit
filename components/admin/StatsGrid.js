"use client";

const LABELS = {
  totalUsers: "Total users",
  pendingUsers: "Pending approval",
  approvedUsers: "Approved",
  trialExhaustedUsers: "Trial exhausted",
  totalGroups: "Groups",
  totalMessages: "Active messages",
  archivedMessages: "Archived messages"
};

export default function StatsGrid({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
      {Object.entries(LABELS).map(([key, label]) => (
        <div key={key} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats[key] ?? "-"}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
