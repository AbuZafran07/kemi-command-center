const PALETTE = [
  "#006837",
  "#2563EB",
  "#7C3AED",
  "#EA580C",
  "#0D9488",
  "#C026D3",
  "#475569",
  "#DC2626",
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const dimension =
    size === "lg" ? "h-16 w-16 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${dimension}`}
      />
    );
  }

  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dimension}`}
      style={{ backgroundColor: colorFor(name || "?") }}
    >
      {initials}
    </span>
  );
}
