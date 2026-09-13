"use client";

import { useState } from "react";
import Avatar from "../common/Avatar";
import { useToast } from "../../hooks/useToast";
import {
  updateGroup,
  uploadGroupImage,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  promoteGroupAdmin,
  demoteGroupAdmin
} from "../../services/groups";

function isAdmin(group, userId) {
  const id = String(userId);
  return String(group.createdBy?._id || group.createdBy) === id
    || (group.admins || []).some((admin) => String(admin._id || admin) === id);
}

export default function GroupSettingsModal({ group, currentUserId, onClose, onUpdated, onLeft }) {
  const { showToast } = useToast();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const amAdmin = isAdmin(group, currentUserId);
  const creatorId = String(group.createdBy?._id || group.createdBy);

  async function handleSaveDetails(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateGroup(group._id, { name, description });
      onUpdated(updated);
      showToast("Group updated", "success");
    } catch (err) {
      showToast(err.message || "Unable to update group", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const updated = await uploadGroupImage(group._id, file);
      onUpdated(updated);
      showToast("Group photo updated", "success");
    } catch (err) {
      showToast(err.message || "Unable to upload group photo", "error");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    const email = newMemberEmail.trim().toLowerCase();
    if (!email) return;
    try {
      const updated = await addGroupMembers(group._id, [email]);
      onUpdated(updated);
      setNewMemberEmail("");
      showToast("Member added", "success");
    } catch (err) {
      showToast(err.message || "Unable to add member", "error");
    }
  }

  async function handleRemoveMember(userId) {
    try {
      const updated = await removeGroupMember(group._id, userId);
      onUpdated(updated);
      showToast("Member removed", "success");
    } catch (err) {
      showToast(err.message || "Unable to remove member", "error");
    }
  }

  async function handlePromote(userId) {
    try {
      const updated = await promoteGroupAdmin(group._id, userId);
      onUpdated(updated);
      showToast("Member promoted to admin", "success");
    } catch (err) {
      showToast(err.message || "Unable to promote member", "error");
    }
  }

  async function handleDemote(userId) {
    try {
      const updated = await demoteGroupAdmin(group._id, userId);
      onUpdated(updated);
      showToast("Admin demoted to member", "success");
    } catch (err) {
      showToast(err.message || "Unable to demote admin", "error");
    }
  }

  async function handleLeave() {
    if (!window.confirm("Leave this group?")) return;
    try {
      await leaveGroup(group._id);
      onLeft();
    } catch (err) {
      showToast(err.message || "Unable to leave group", "error");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>Group settings</h2>

        <div className="profile-photo-row">
          <Avatar name={group.name} photo={group.image} size={56} />
          {amAdmin && (
            <label className="btn btn-secondary" style={{ display: "inline-flex" }}>
              {uploadingImage ? "Uploading..." : "Change photo"}
              <input type="file" accept="image/*" hidden onChange={handleImageChange} disabled={uploadingImage} />
            </label>
          )}
        </div>

        <form onSubmit={handleSaveDetails}>
          <div className="field">
            <label htmlFor="groupName">Name</label>
            <input
              id="groupName"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!amAdmin}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="groupDescription">Description</label>
            <textarea
              id="groupDescription"
              rows={2}
              maxLength={300}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!amAdmin}
            />
          </div>
          {amAdmin && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save details"}
            </button>
          )}
        </form>

        <h3 style={{ fontSize: "0.9rem", marginTop: 20 }}>Members ({group.members.length})</h3>
        <div className="chip-list" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {group.members.map((member) => {
            const memberIsAdmin = isAdmin(group, member._id);
            const memberIsCreator = String(member._id) === creatorId;
            return (
              <div
                key={member._id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={member.name} size={28} />
                  <div>
                    <div style={{ fontSize: "0.85rem" }}>
                      {member.name} {memberIsCreator && <span style={{ color: "var(--text-muted)" }}>(creator)</span>}
                      {!memberIsCreator && memberIsAdmin && <span style={{ color: "var(--text-muted)" }}> (admin)</span>}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{member.email}</div>
                  </div>
                </div>
                {amAdmin && String(member._id) !== String(currentUserId) && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {!memberIsCreator && (
                      memberIsAdmin ? (
                        <button type="button" className="btn btn-secondary" onClick={() => handleDemote(member._id)}>
                          Demote
                        </button>
                      ) : (
                        <button type="button" className="btn btn-secondary" onClick={() => handlePromote(member._id)}>
                          Promote
                        </button>
                      )
                    )}
                    {!memberIsCreator && (
                      <button type="button" className="btn btn-secondary" style={{ color: "var(--danger)" }} onClick={() => handleRemoveMember(member._id)}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {amAdmin && (
          <form onSubmit={handleAddMember} style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="Add member by email"
              value={newMemberEmail}
              onChange={(event) => setNewMemberEmail(event.target.value)}
            />
            <button type="submit" className="btn btn-secondary">Add</button>
          </form>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" style={{ color: "var(--danger)" }} onClick={handleLeave}>
            Leave group
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
