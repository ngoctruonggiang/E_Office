import { cn } from "@/lib/utils/cn";

/** Deterministic background from a string, so each user keeps one color. */
const COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

function hashIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Small circular initials avatar — no image dependency. */
export function Avatar({
  name,
  seed,
  size = "md",
}: {
  name: string;
  /** Stable color seed (e.g. user id); defaults to the name. */
  seed?: string;
  size?: "sm" | "md";
}) {
  const color = COLORS[hashIndex(seed ?? name, COLORS.length)];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white",
        size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs",
        color,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
