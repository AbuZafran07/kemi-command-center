export function AgentAvatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  const dimension = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-xl font-semibold text-white ${dimension}`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
