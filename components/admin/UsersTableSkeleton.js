"use client";

export default function UsersTableSkeleton({ rows = 5 }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10
          }}
        >
          <div className="skeleton skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton skeleton-line" style={{ width: "35%" }} />
            <div className="skeleton skeleton-line" style={{ width: "55%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
