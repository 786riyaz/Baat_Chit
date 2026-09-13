"use client";

export default function TrialBanner({ user }) {
  if (user.role === "admin" || user.approvalStatus === "approved") return null;

  if (user.approvalStatus === "rejected" || user.approvalStatus === "suspended") {
    return (
      <div className="trial-banner warning">
        <span>Your account access is currently restricted. You can still message the administrator.</span>
      </div>
    );
  }

  const remaining = Math.max(0, (user.trialMessageLimit || 0) - (user.trialMessageCount || 0));
  if (remaining <= 0) {
    return (
      <div className="trial-banner warning">
        <span>Your free message limit has been reached. Admin approval is required to continue messaging - you can still message the administrator.</span>
      </div>
    );
  }
  return (
    <div className="trial-banner info">
      <span>Free trial: {remaining} message{remaining === 1 ? "" : "s"} remaining</span>
    </div>
  );
}
