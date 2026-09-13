"use client";

import Link from "next/link";
import ProtectedRoute from "../../components/common/ProtectedRoute";
import AvatarUploader from "../../components/profile/AvatarUploader";
import ProfileDetailsForm from "../../components/profile/ProfileDetailsForm";
import PasswordForm from "../../components/profile/PasswordForm";
import TrialStatusBadge from "../../components/profile/TrialStatusBadge";
import { useAuth } from "../../hooks/useAuth";

function ProfileContent() {
  const { user, setUser } = useAuth();

  return (
    <div className="profile-shell">
      <div className="profile-card">
        <Link href="/chat" className="back-link">&larr; Back to chat</Link>
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
