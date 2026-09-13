"use client";

import { useState } from "react";
import Avatar from "../common/Avatar";
import { useToast } from "../../hooks/useToast";
import { uploadProfilePhoto } from "../../services/auth";

export default function AvatarUploader({ user, onUpdated }) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadProfilePhoto(file);
      onUpdated(updated);
      showToast("Profile photo updated", "success");
    } catch (err) {
      showToast(err.message || "Unable to upload photo", "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="profile-photo-row">
      <Avatar name={user.name} photo={user.profilePhoto} size={72} />
      <div>
        <div style={{ fontWeight: 600 }}>{user.name}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{user.email}</div>
        <label className="btn btn-secondary" style={{ marginTop: 8, display: "inline-flex" }}>
          {uploading ? "Uploading..." : "Change photo"}
          <input type="file" accept="image/*" hidden onChange={handleChange} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
