"use client";

export function initials(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Avatar({ name, photo, size, online }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.4 } : undefined;
  return (
    <div className="avatar" style={style}>
      {photo ? <img src={photo} alt={name} /> : initials(name)}
      {online && <span className="presence-dot" />}
    </div>
  );
}
