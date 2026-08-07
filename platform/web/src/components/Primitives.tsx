import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import type { CreatedShare } from "../types";

export function Button({
  children,
  variant = "primary",
  icon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: Parameters<typeof Icon>[0]["name"];
}) {
  return (
    <button className={`button button--${variant}`} {...props}>
      {icon ? <Icon name={icon} width={17} height={17} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`section ${className}`} {...props}>
      {title || description || action ? (
        <div className="section__head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * The four readings any state can have. Every founder-facing status vocabulary — workstream,
 * decision, deliverable, task, readiness category, launch-engine step — collapses to one of
 * these, so a status dot, a progress track, and a due date can all be tinted from the same
 * decision instead of from three separate colour lists.
 */
export type Tone = "positive" | "caution" | "critical" | "info" | "neutral";

const STATUS_TONES: Record<string, Tone> = {
  "on-track": "positive",
  complete: "positive",
  completed: "positive",
  finished: "positive",
  ready: "positive",
  decided: "positive",
  approved: "positive",
  reviewed: "positive",
  active: "positive",
  blocked: "critical",
  failed: "critical",
  "needs-attention": "caution",
  // A launch category below the in-progress threshold is unfinished work, not an absent state;
  // left neutral it reads exactly like "not started".
  "not-ready": "caution",
  proposed: "caution",
  revisit: "caution",
  open: "caution",
  "in-progress": "caution",
  running: "caution",
  "needs-founder": "caution",
  held: "caution",
  processing: "caution",
  draft: "info",
  queued: "info",
};

export function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral";
}

export function StatusText({ status }: { status: string }) {
  return (
    <span className={`status-text tone-${statusTone(status)}`}>
      <span className="status-text__dot" />
      {humanize(status)}
    </span>
  );
}

/**
 * Progress carries its own state. A blocked body of work at 46% must not draw the same
 * healthy bar as an on-track one — the track is tinted from the status beside it, which makes
 * the colour redundant with the word rather than the only way to read the state.
 */
export function ProgressLine({
  value,
  label,
  hideValue = false,
  tone = "positive",
}: {
  value: number;
  label?: string;
  hideValue?: boolean;
  tone?: Tone;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`progress-line tone-${tone}`}>
      <progress className="progress-line__track" value={clamped} max={100} aria-label={label ?? "Progress"} />
      {hideValue ? null : <span className="progress-line__value">{clamped}%</span>}
    </div>
  );
}

/**
 * Evidence quality at a glance: five ledger ticks plus the number itself. It borrows the
 * sidebar stage strip's shape on purpose — one instrument idiom across the product — and it
 * is deliberately coarse, because a 3%-wide difference in confidence is not a real difference.
 */
export function ConfidenceMark({ value, caption = "Confidence" }: { value: number; caption?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.round(clamped / 20);
  return (
    <span className="confidence-mark" role="img" aria-label={`${caption} ${clamped}%`}>
      <span className="confidence-mark__segments" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className={index < filled ? "is-on" : ""} />
        ))}
      </span>
      <span className="confidence-mark__value">{clamped}%</span>
    </span>
  );
}

/**
 * How much a task matters, in the same dot-and-word shape as a status. Only critical and high
 * carry an urgent tint; medium and low stay calm on purpose — half the queue tinted amber is
 * not urgency, it is noise.
 */
export function Priority({ value }: { value: "critical" | "high" | "medium" | "low" }) {
  return (
    <span className={`priority priority--${value}`}>
      <span className="priority__dot" aria-hidden="true" />
      {value}
    </span>
  );
}

/**
 * A short ledger of counts — "02 blocked · 02 needs attention · 04 on track". Used where a
 * founder would otherwise have to count rows themselves. Counts only; never a computed metric.
 */
export function Tally({ items }: { items: Array<{ id: string; label: string; count: number; tone?: Tone }> }) {
  const shown = items.filter((item) => item.count > 0);
  if (!shown.length) return null;
  return (
    <ul className="tally">
      {shown.map((item) => (
        <li key={item.id} className={`tone-${item.tone ?? "neutral"}`}>
          <strong>{formatCount(item.count)}</strong>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-wrap">
      <select {...props}>{children}</select>
      <span aria-hidden="true">⌄</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="eyebrow">Nothing to review yet</p>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice--error" role="alert">
      <Icon name="warning" width={20} height={20} />
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Toast({
  message,
  tone = "success",
  onDismiss,
  onHoldChange,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss?: () => void;
  onHoldChange?: (held: boolean) => void;
}) {
  return (
    <div
      className={`toast toast--${tone}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => onHoldChange?.(true)}
      onMouseLeave={() => onHoldChange?.(false)}
      onFocus={() => onHoldChange?.(true)}
      onBlur={() => onHoldChange?.(false)}
    >
      <Icon name={tone === "success" ? "check" : "warning"} width={18} height={18} />
      <span className="toast__message">{message}</span>
      {onDismiss ? (
        <button className="icon-button toast__dismiss" onClick={onDismiss} aria-label="Dismiss message">
          <Icon name="close" width={16} height={16} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The expandable technical layer under a board-level statement. The top level stays in board
 * language; a founder who wants the specifics opens this (design-system.md: "Reveal system
 * detail only when useful").
 */
export function TechnicalDisclosure({ label = "Technical detail", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="technical-disclosure">
      <summary>{label}</summary>
      <div className="technical-disclosure__body">{children}</div>
    </details>
  );
}

/**
 * Two conflicting claims, each individually labeled by kind, so the founder can see which
 * statement to retire instead of parsing one joined sentence.
 */
export function ContradictionStatements({
  entries,
  fallback,
}: {
  entries?: Array<{ claimId: string; kind: string; statement: string }>;
  fallback: string;
}) {
  if (!entries || entries.length < 2) return <p>{fallback}</p>;
  return (
    <ul className="contradiction-entries">
      {entries.map((entry) => (
        <li key={entry.claimId}>
          <span className="claim-kind">{humanize(entry.kind)}</span>
          <span>{entry.statement}</span>
        </li>
      ))}
    </ul>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () => dialog
      ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      : [];
    (focusable()[0] ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => closeRef.current()}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button className="icon-button" onClick={() => closeRef.current()} aria-label="Close dialog">
            <Icon name="close" width={20} height={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function humanize(value: string) {
  const words = value.replace(/[._-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Ledger-style count: two digits so columns of counts align ("02", "14"). Only for
 * counts that live in fact tables, never for scores or percentages.
 */
export function formatCount(value: number) {
  return String(Math.max(0, Math.trunc(value))).padStart(2, "0");
}

export function formatDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

/**
 * A date a founder is accountable to, read as time remaining rather than as a calendar
 * coordinate. "Aug 12, 2026" does not tell anyone whether to act today; "in 6 days" does.
 * The words carry the urgency on their own — the tone only reinforces what the text says.
 */
export function dateSignal(value: string | null | undefined, fallback = "No date", horizonDays = 30) {
  const absolute = formatDate(value, fallback);
  if (!value) return { absolute, relative: null, tone: "neutral" as Tone, days: null };
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return { absolute, relative: null, tone: "neutral" as Tone, days: null };

  // Compare whole calendar days so a deadline stops being "today" at midnight, not at the
  // same clock time it was recorded.
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(parsed) - startOfDay(new Date())) / 86_400_000);

  if (days < 0) return { absolute, relative: days === -1 ? "1 day late" : `${-days} days late`, tone: "critical" as Tone, days };
  if (days === 0) return { absolute, relative: "Today", tone: "caution" as Tone, days };
  if (days === 1) return { absolute, relative: "Tomorrow", tone: "caution" as Tone, days };
  if (days <= 7) return { absolute, relative: `In ${days} days`, tone: "caution" as Tone, days };
  // Past the horizon the day count stops helping anyone plan and the date itself is the useful
  // fact — except where the horizon is the point, like the launch target, which passes its own.
  if (days <= horizonDays) return { absolute, relative: `In ${days} days`, tone: "neutral" as Tone, days };
  return { absolute, relative: null, tone: "neutral" as Tone, days };
}

/** The date and how much time is left, as one unit of metadata. */
export function DateSignal({
  value,
  fallback = "No date",
  horizonDays = 30,
}: {
  value: string | null | undefined;
  fallback?: string;
  horizonDays?: number;
}) {
  const signal = dateSignal(value, fallback, horizonDays);
  return (
    <span className={`date-signal tone-${signal.tone}`}>
      <span className="date-signal__absolute">{signal.absolute}</span>
      {signal.relative ? <span className="date-signal__relative">{signal.relative}</span> : null}
    </span>
  );
}

export function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, divisor] of units) {
    if (Math.abs(seconds) >= divisor) return formatter.format(Math.round(seconds / divisor), unit);
  }
  return "just now";
}

/**
 * The deliverable body language: paragraphs, and lines beginning with "- " as a list. Deliberately
 * not a Markdown parser — this renders founder- and engine-authored text, so anything it does not
 * understand must come out as the words that were written rather than as markup.
 */
export function MarkdownBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/);
  return <>{blocks.map((block, index) => block.startsWith("- ") ? (
    <ul key={index}>{block.split("\n").map((line, lineIndex) => <li key={`${index}-${lineIndex}`}>{line.replace(/^\-\s*/, "")}</li>)}</ul>
  ) : <p key={index}>{block}</p>)}</>;
}

/**
 * A share link, shown exactly once. Same shape as the invitation notice on the People page, and
 * the same honesty: a link that cannot be shown again must never be believed copied when it was not.
 */
export function ShareLinkNotice({ created, onDismiss }: { created: CreatedShare; onDismiss: () => void }) {
  const link = `${window.location.origin}${created.viewPath}`;
  const [copied, setCopied] = useState<boolean | "unavailable">(false);

  const copy = async () => {
    if (!navigator.clipboard) {
      setCopied("unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied("unavailable");
    }
  };

  return (
    <div className="invitation-link">
      <p className="eyebrow">Anyone with this link can read {created.share.label}</p>
      <p>{created.delivery}</p>
      <code>{link}</code>
      <div className="button-row">
        <Button type="button" onClick={() => void copy()}>{copied === true ? "Copied" : "Copy link"}</Button>
        <Button type="button" variant="secondary" onClick={onDismiss}>Done</Button>
      </div>
      {copied === "unavailable" ? (
        <p className="muted-copy">This browser would not let Formation copy for you. Select the link above and copy it yourself.</p>
      ) : null}
      <p className="muted-copy">
        This link is shown once. If you lose it, stop it and share again.
      </p>
    </div>
  );
}
