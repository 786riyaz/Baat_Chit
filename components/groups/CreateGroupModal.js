"use client";

import { useState } from "react";

export default function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function addMember(event) {
    event.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (members.includes(email)) {
      setEmailInput("");
      return;
    }
    setMembers((prev) => [...prev, email]);
    setEmailInput("");
  }

  function removeMember(email) {
    setMembers((prev) => prev.filter((item) => item !== email));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), memberEmails: members });
    } catch (err) {
      setError(err.message || "Unable to create group");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>Create a group</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="groupName">Group name</label>
            <input
              id="groupName"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="memberEmail">Add members by email</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="memberEmail"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="friend@example.com"
              />
              <button type="button" className="btn btn-secondary" onClick={addMember}>
                Add
              </button>
            </div>
            {members.length > 0 && (
              <div className="chip-list">
                {members.map((email) => (
                  <span key={email} className="chip">
                    {email}
                    <button type="button" onClick={() => removeMember(email)}>&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={submitting}>
              {submitting ? "Creating..." : "Create group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
