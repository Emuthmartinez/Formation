import { useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

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

export function StatusText({ status }: { status: string }) {
  return (
    <span className={`status-text status-text--${status}`}>
      <span className="status-text__dot" />
      {humanize(status)}
    </span>
  );
}

export function ProgressLine({ value, label, hideValue = false }: { value: number; label?: string; hideValue?: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-line">
      <progress className="progress-line__track" value={clamped} max={100} aria-label={label ?? "Progress"} />
      {hideValue ? null : <span className="progress-line__value">{clamped}%</span>}
    </div>
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

export function formatDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
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
