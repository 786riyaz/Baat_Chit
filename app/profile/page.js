"use client";

import Link from "next/link";
import ProtectedRoute from "../../components/common/ProtectedRoute";
import AvatarUploader from "../../components/profile/AvatarUploader";
import ProfileDetailsForm from "../../components/profile/ProfileDetailsForm";
import PasswordForm from "../../components/profile/PasswordForm";
import TrialStatusBadge from "../../components/profile/TrialStatusBadge";
import ThemeToggle from "../../components/common/ThemeToggle";
import { useAuth } from "../../hooks/useAuth";

function ProfileContent() {
  const { user, setUser } = useAuth();

  return (
    <div className="profile-shell">
      <div className="profile-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/chat" className="back-link" style={{ marginBottom: 0 }}>&larr; Back to chat</Link>
          <ThemeToggle className="icon-btn-outline" />
        </div>
        <AvatarUploader user={user} onUpdated={setUser} />
        <div style={{ marginBottom: 20 }}>
          <TrialStatusBadge user={user} />
        </div>
        <ProfileDetailsForm user={user} onUpdated={setUser} />
        <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid var(--border)" }} />
        <PasswordForm onUpdated={setUser} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
