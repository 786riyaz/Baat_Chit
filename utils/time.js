// Explicit hour12: true so times always show as 12-hour with AM/PM,
// regardless of the device's locale/region settings (some locales default
// toLocaleTimeString to 24-hour, which is why times were inconsistent
// across devices before this was explicit).
export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export function formatLastSeen(date) {
  const parsed = new Date(date);
  const day = parsed.toLocaleDateString([], { month: "short", day: "numeric" });
  return `Last seen ${day} ${formatTime(parsed)}`;
}
