"use client";

import Avatar from "../common/Avatar";

const STATUS_COLORS = {
  pending: "pending",
  approved: "approved",
  rejected: "restricted",
  suspended: "restricted"
};

export default function UsersTable({ users, onApprove, onSuspend, onReject, onRevoke }) {
  if (users.length === 0) {
    return <div className="sidebar-empty" style={{ color: "var(--text-muted)" }}>No users found.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {users.map((targetUser) => (
        <div
          key={targetUser._id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={targetUser.name} photo={targetUser.profilePhoto} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{targetUser.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {targetUser.email} - {targetUser.phone}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Trial: {targetUser.trialMessageCount}/{targetUser.trialMessageLimit}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {targetUser.role === "admin" ? (
              <span className="trial-pill approved">Admin</span>
            ) : (
              <span className={`trial-pill ${STATUS_COLORS[targetUser.approvalStatus] || "pending"}`}>
                {targetUser.approvalStatus}
              </span>
            )}
            {targetUser.role !== "admin" && (
              <div style={{ display: "flex", gap: 4 }}>
                {targetUser.approvalStatus !== "approved" && (
                  <button className="btn btn-secondary" onClick={() => onApprove(targetUser._id)}>Approve</button>
                )}
                {targetUser.approvalStatus !== "suspended" && (
                  <button className="btn btn-secondary" onClick={() => onSuspend(targetUser._id)}>Suspend</button>
                )}
                {targetUser.approvalStatus !== "rejected" && (
                  <button className="btn btn-secondary" onClick={() => onReject(targetUser._id)}>Reject</button>
                )}
                {targetUser.approvalStatus !== "pending" && (
                  <button className="btn btn-secondary" onClick={() => onRevoke(targetUser._id)}>Revoke</button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
