"use client";

import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import { updateProfile } from "../../services/auth";

export default function PasswordForm({ onUpdated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      onUpdated(updated);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("Password changed", "success");
    } catch (err) {
      showToast(err.message || "Unable to change password", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 style={{ fontSize: "1rem" }}>Change password</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="currentPassword">Current password</label>
          <input
            id="currentPassword"
            type="password"
            value={form.currentPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            type="password"
            value={form.newPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>
    </>
  );
}
