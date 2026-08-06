/**
 * The Formation strata motif: fine concentric contour lines, like an engraved survey map.
 * Purely decorative print texture — always aria-hidden, positioned by the parent, and kept
 * at low opacity so it never competes with content (design-system.md: color communicates
 * state; the motif communicates identity only).
 */
export function Motif({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`motif ${className}`}
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M200 62c58-8 118 10 144 52 25 40 18 96-8 132-27 38-74 62-124 58-52-4-104-30-126-74-21-42-8-98 26-128 26-24 55-35 88-40Z" />
      <path d="M201 88c47-6 95 10 116 44 20 32 14 76-7 105-22 30-60 49-100 46-42-3-83-25-100-60-17-34-7-78 20-102 21-19 45-29 71-33Z" />
      <path d="M202 114c37-5 73 9 89 35 15 25 11 57-6 79-17 23-46 37-77 35-32-3-63-19-76-46-13-26-5-59 16-77 16-14 34-23 54-26Z" />
      <path d="M203 140c26-3 51 7 62 25 11 17 8 39-4 54-12 16-32 26-54 24-23-2-44-13-53-32-9-18-4-41 11-53 11-10 24-16 38-18Z" />
      <path d="M204 166c15-2 29 5 35 15 6 10 4 22-3 30-7 9-18 15-30 14-13-1-25-8-30-18-5-11-2-23 6-30 6-6 13-10 22-11Z" />
      <path d="M14 330c40-18 74-46 96-82" opacity=".7" />
      <path d="M-4 302c52-20 96-56 124-104" opacity=".7" />
      <path d="M292 386c34-24 60-58 74-98" opacity=".7" />
    </svg>
  );
}
