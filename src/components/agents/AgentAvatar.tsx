import { useEffect, useState } from "react";

// Fallback tones stay inside the single brand green family (per the UI refresh's
// "hijau saja" rule) -- only lightness varies, picked deterministically per agent.
const GREEN_TONES = [
  "oklch(0.452 0.114 158.2)",
  "oklch(0.52 0.13 157)",
  "oklch(0.6 0.145 156)",
  "oklch(0.68 0.15 155)",
];

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GREEN_TONES[hash % GREEN_TONES.length];
}

export function AgentAvatar({
  name,
  color,
  avatarUrl,
  status = "online",
  size = "md",
}: {
  name: string;
  /** Optional explicit override (used by the admin colour picker's live preview).
   *  Every other call site omits this so the tone comes from the green-only ramp. */
  color?: string;
  avatarUrl?: string | null | undefined;
  status?: "online" | "offline";
  size?: "sm" | "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [avatarUrl]);

  const dimension =
    size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  const dotSize = size === "lg" ? "h-3.5 w-3.5" : size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span className="relative inline-flex shrink-0">
      {avatarUrl && !broken ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setBroken(true)}
          className={`shrink-0 rounded-xl object-cover shadow-soft ${dimension}`}
        />
      ) : (
        <span
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-xl font-display font-semibold text-white shadow-soft ${dimension}`}
          style={{ backgroundColor: color || toneFor(name || "?") }}
        >
          {name.trim().slice(0, 2).toUpperCase()}
        </span>
      )}
      <span
        aria-hidden
        className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background ${dotSize} ${
          status === "online" ? "bg-brand-light" : "bg-muted-foreground/50"
        }`}
      />
    </span>
  );
}
