"use client";

// Alternating widths/sides so it reads as a plausible conversation shape
// rather than a uniform grid.
const ROWS = [
  { mine: false, width: 160 },
  { mine: true, width: 120 },
  { mine: false, width: 210 },
  { mine: false, width: 90 },
  { mine: true, width: 180 },
  { mine: true, width: 100 }
];

export default function MessagesSkeleton() {
  return (
    <div aria-hidden="true" style={{ padding: "4px 0" }}>
      {ROWS.map((row, index) => (
        <div key={index} className={`skeleton-bubble-row ${row.mine ? "mine" : ""}`}>
          <div className="skeleton skeleton-bubble" style={{ width: row.width }} />
        </div>
      ))}
    </div>
  );
}
