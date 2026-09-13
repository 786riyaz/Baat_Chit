"use client";

export default function TrialStatusBadge({ user }) {
  if (user.role === "admin") {
    return <span className="trial-pill approved">Admin</span>;
  }
  if (user.approvalStatus === "approved") {
    return <span className="trial-pill approved">Approved - unlimited messaging</span>;
  }
  if (user.approvalStatus === "pending") {
    const remaining = Math.max(0, (user.trialMessageLimit || 0) - (user.trialMessageCount || 0));
    return remaining > 0 ? (
      <span className="trial-pill pending">{remaining} free message(s) remaining</span>
    ) : (
      <span className="trial-pill restricted">Free trial used - admin approval required</span>
    );
  }
  return <span className="trial-pill restricted">Account {user.approvalStatus}</span>;
}
