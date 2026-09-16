"use client";

export default function StatsGridSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}
    >
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div className="skeleton skeleton-line" style={{ width: "40%", height: 22, marginBottom: 8 }} />
          <div className="skeleton skeleton-line" style={{ width: "70%" }} />
        </div>
      ))}
    </div>
  );
}
