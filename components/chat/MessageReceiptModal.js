"use client";

import Avatar from "../common/Avatar";

function memberStatus(message, memberId) {
  const id = String(memberId);
  const readBy = (message.readBy || []).map(String);
  const deliveredTo = (message.deliveredTo || []).map(String);
  if (readBy.includes(id)) return "Read";
  if (deliveredTo.includes(id)) return "Delivered";
  return "Sent";
}

export default function MessageReceiptModal({ message, members, senderId, onClose }) {
  const recipients = members.filter((member) => String(member._id) !== String(senderId));
  const readCount = recipients.filter((member) => memberStatus(message, member._id) === "Read").length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 360 }}>
        <h2>Message info</h2>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
          Read by {readCount} of {recipients.length}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recipients.map((member) => {
            const status = memberStatus(message, member._id);
            return (
              <div key={member._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={member.name} photo={member.profilePhoto} online={member.isOnline} size={30} />
                  <span style={{ fontSize: "0.85rem" }}>{member.name}</span>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: status === "Read" ? "var(--success)" : "var(--text-muted)"
                  }}
                >
                  {status}
                </span>
              </div>
            );
          })}
          {recipients.length === 0 && (
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No other members in this group yet.</div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
