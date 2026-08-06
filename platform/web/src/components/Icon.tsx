import type { SVGProps } from "react";

type IconName =
  | "home"
  | "business"
  | "work"
  | "decision"
  | "document"
  | "launch"
  | "plus"
  | "arrow"
  | "check"
  | "warning"
  | "spark"
  | "menu"
  | "close"
  | "download"
  | "edit"
  | "logout";

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "home":
      return <svg {...common}><path d="m4 11 8-7 8 7" /><path d="M6.5 10.5V20h11v-9.5" /><path d="M10 20v-6h4v6" /></svg>;
    case "business":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M8.5 15.5 15.5 8.5" /><path d="M9 8h7v7" /></svg>;
    case "work":
      return <svg {...common}><path d="M5 5h14v14H5z" /><path d="M5 10h14" /><path d="M10 10v9" /></svg>;
    case "decision":
      return <svg {...common}><path d="M6 4h12v16H6z" /><path d="m9 9 2 2 4-4" /><path d="M9 15h6" /></svg>;
    case "document":
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4" /><path d="M10 12h5M10 16h5" /></svg>;
    case "launch":
      return <svg {...common}><path d="M14 4c3 1 5 3 6 6l-6 6-6-6z" /><path d="m9 15-3 3" /><path d="M6 11 3 14l4 1" /><path d="m13 17 1 4 3-3" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "warning":
      return <svg {...common}><path d="M12 3 2.8 20h18.4z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case "spark":
      return <svg {...common}><path d="M12 2c.6 5.4 3.2 8 8 8-4.8 0-7.4 2.6-8 8-.6-5.4-3.2-8-8-8 4.8 0 7.4-2.6 8-8Z" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "close":
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "download":
      return <svg {...common}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>;
    case "edit":
      return <svg {...common}><path d="m4 20 4-.8L19 8.2 15.8 5 4.8 16z" /><path d="m13.8 7 3.2 3.2" /></svg>;
    case "logout":
      return <svg {...common}><path d="M10 5H5v14h5" /><path d="M13 8l4 4-4 4" /><path d="M8 12h9" /></svg>;
  }
}
