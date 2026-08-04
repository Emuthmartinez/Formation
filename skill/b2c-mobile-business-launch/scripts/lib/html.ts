/**
 * html.ts — the one HTML escape this skill renders and grades with.
 *
 * Six files carried their own copy of this function: three renderers
 * (render-launch-cockpit, render-design-room, lib/render-artifact-page), one
 * shared markup builder (lib/founder-gate-presentation), one gate that asserts
 * against rendered output (check-founder-operator-bootstrap), and one machine
 * report writer (refresh-source-freshness). They had drifted into two shapes —
 * three took `string`, three took `unknown` — which is how a gate and the
 * renderer it grades can disagree about what an undefined value escapes to.
 *
 * The signature here is the wider one. `String(value ?? "")` is the identity on
 * a string, so the former `string` callers are unchanged, and a nullish value
 * renders as an empty cell instead of the literal text "undefined".
 *
 * **The single quote is deliberately not escaped.** Every attribute this skill
 * writes is double-quoted, so `'` needs no escaping to be safe, and escaping it
 * would rewrite the bytes of every generated page — which `check:generated-pages`
 * compares against a fresh render, and which `design/design-room.html` pins as a
 * byte-identical static fallback. A stricter escape here buys no safety and
 * turns two byte-match gates red.
 *
 * `business/growth/resend/email-templates.ts` keeps its own copy on purpose and is not
 * a seventh caller: it is payload copied into a launched business repo, where
 * nothing under `scripts/` exists to import. Its extra `&#39;` rule is correct
 * for its own reason — email HTML passes through client rewriters that do not
 * all agree on attribute quoting.
 */

/** HTML-escape a value for text content or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
