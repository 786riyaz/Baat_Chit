"use client";

import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import { updateProfile } from "../../services/auth";

export default function ProfileDetailsForm({ user, onUpdated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, bio: user.bio || "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      onUpdated(updated);
      showToast("Profile updated", "success");
    } catch (err) {
      showToast(err.message || "Unable to update profile", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrivacyToggle(nextValue) {
    try {
      const updated = await updateProfile({ lastSeenPrivacy: nextValue });
      onUpdated(updated);
      showToast("Privacy setting updated", "success");
    } catch (err) {
      showToast(err.message || "Unable to update privacy setting", "error");
    }
  }

  return (
    <>
      <h2 style={{ fontSize: "1rem" }}>Profile details</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            rows={3}
            maxLength={200}
            value={form.bio}
            onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
          />
        </div>
        <div className="field">
          <label>Last seen visibility</label>
          <select
            value={user.lastSeenPrivacy || "everyone"}
            onChange={(event) => handlePrivacyToggle(event.target.value)}
          >
            <option value="everyone">Everyone</option>
            <option value="nobody">Nobody</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </>
  );
}
