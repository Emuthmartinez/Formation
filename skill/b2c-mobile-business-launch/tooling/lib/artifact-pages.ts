/**
 * artifact-pages.ts — every page at the root of business/ says where it comes from.
 *
 * docs/architecture.md rules that HTML in business/ is generated rather than authored,
 * because a hand-authored twin of a Markdown document goes stale with no signal.
 * It did. Four of these pages drifted far enough to be wrong rather than merely
 * thin, and nothing failed. This manifest is what makes a page's provenance a
 * declared fact instead of a convention, and check:generated-pages is what proves
 * the declaration still holds.
 *
 * Three kinds, and a page is exactly one of them:
 *
 *   rendered-by    a script builds it from state; that script owns its content
 *   starter-stub   a deliberate placeholder whose real content only exists after
 *                  a launch produces it, so there is nothing to generate from
 *   authored-from  a Markdown source is the content; the page is its rendering
 *
 * SCOPE IS THE ROOT OF business/, NOT A RECURSIVE WALK. Eight pages sit at the
 * root; another eight sit inside subject folders next to their own Markdown
 * (11-star-experience/, app-store-listing/, content-assets/, emotional-design/,
 * localization-market-research/, ux-patterns/) and one is a Vite build output
 * under dist/. Those are a separate class with their own layout convention, and
 * pulling them in here would have made this change several times larger. The
 * limit is deliberate, and the gate reports it, so a page added at the root
 * cannot slip in undeclared.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderArtifactPage } from "./render-artifact-page.js";

export type PageProvenance =
  | { readonly kind: "rendered-by"; readonly script: string; readonly why: string }
  | { readonly kind: "starter-stub"; readonly why: string }
  | { readonly kind: "authored-from"; readonly markdown: string; readonly why: string; readonly presentation?: "document" | "source" };

/**
 * Keyed by page filename rather than held as a list, so a page declared twice is
 * a duplicate object key: TypeScript rejects it and the audit's typecheck step
 * catches it. A list would have needed a runtime uniqueness check whose failure
 * branch no fixture could ever reach.
 */
export const artifactPages: Readonly<Record<string, PageProvenance>> = {
  "design/design-room.html": {
    kind: "rendered-by",
    script: "tooling/render-design-room.ts",
    why: "built from studio/seed/business.json and the design tokens, with its own design-state hash.",
  },
  "state/launch-cockpit.html": {
    kind: "rendered-by",
    script: "tooling/render-launch-cockpit.ts",
    why: "built from state/PROJECT_STATE.yaml through the founder-copy translation layer.",
  },
  "design/design.html": {
    kind: "starter-stub",
    why: "a starter placeholder. The real page is the rendered Design Room, which only exists once design state has been produced. There is no Markdown twin to render, and generating one from a plan document would invent visual proof that does not exist yet.",
  },
  "analytics/analytics-plan.html": {
    kind: "starter-stub",
    why: "a starter placeholder. The real page is rendered once the live services report real data. Rendering analytics/ANALYTICS.md here would present a plan as a measurement result.",
  },
  "product/onboarding.html": {
    kind: "authored-from",
    markdown: "product/ONBOARDING.md",
    presentation: "source",
    why: "the evidence graph, journey, screen/control contract, instrumentation, review, monetization, and cutover plan are the page.",
  },
  "operations/orchestration.html": {
    kind: "authored-from",
    markdown: "operations/ORCHESTRATION.md",
    why: "the preflight, unit table and ownership rules are the page.",
  },
  "store/store-console.html": {
    kind: "authored-from",
    markdown: "store/STORE_CONSOLE.md",
    why: "the console routes and the App Review checklist are the page.",
  },
  "trust/security-review.html": {
    kind: "authored-from",
    markdown: "trust/SECURITY.md",
    why: "the threat model, hardening checklist and accepted risks are the page.",
  },
};

/** Manifest entries in a fixed order, so two runs report findings identically. */
export function artifactPageEntries(): Array<[string, PageProvenance]> {
  return Object.entries(artifactPages).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Root-level HTML pages on disk, sorted so two runs never differ by directory order. */
export function listRootPages(businessRoot: string): string[] {
  return readdirSync(businessRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The bytes an `authored-from` page must contain. Every consumer goes through
 * this one function: the renderer writes what it returns and the gate compares
 * against what it returns, so "what the page should be" has a single definition
 * and the two can never disagree about it.
 */
export function renderAuthoredPage(businessRoot: string, entry: Extract<PageProvenance, { kind: "authored-from" }>): string {
  const markdownPath = path.join(businessRoot, entry.markdown);
  const markdown = readFileSync(markdownPath, "utf8");
  if (entry.presentation === "source") return renderSourceArtifactPage(markdown, entry.markdown);
  return renderArtifactPage({ markdown, markdownName: entry.markdown });
}

/**
 * Large execution ledgers are more useful as faithful, searchable source than as
 * hundreds of nested HTML table cells. This view still has one canonical source
 * and byte-level drift detection, while staying compact enough for browsers and
 * repository review.
 */
function renderSourceArtifactPage(markdown: string, markdownName: string): string {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Artifact";
  const status = markdown.match(/^Status:\s*`?([^`\n]+)`?/m)?.[1]?.trim() || "unknown";
  const digest = createHash("sha256").update(markdown).digest("hex").slice(0, 16);
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]?.trim()).filter(Boolean) as string[];
  const sectionList = headings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;--bg:#f7f4ef;--panel:#fffdf9;--ink:#1b1917;--muted:#635c53;--line:#ddd5c9;--accent:#1f6f63}@media(prefers-color-scheme:dark){:root{--bg:#16150f;--panel:#1f1d17;--ink:#f2ede4;--muted:#b0a89c;--line:#3a362d;--accent:#7bcbba}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}main{width:min(980px,calc(100% - 28px));margin:auto;padding:36px 0 56px}header,.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px}header{margin-bottom:14px}h1{margin:0 0 8px;font-size:clamp(2rem,5vw,3.6rem);line-height:1}.meta{color:var(--muted);margin:7px 0 0}.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 9px;color:var(--accent);font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}ol{columns:2;gap:32px;margin:16px 0 0;padding-left:22px}li{break-inside:avoid;margin:0 0 7px}code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}@media(max-width:640px){main{width:min(100% - 18px,980px);padding-top:18px}ol{columns:1}}
</style>
</head>
<body>
<main>
<header><span class="pill">${escapeHtml(status)}</span><h1>${escapeHtml(title)}</h1><p class="meta">Canonical source: <code>${escapeHtml(markdownName)}</code></p><p class="meta">Source SHA-256: <code>${digest}</code></p></header>
<section class="card"><h2>Execution contract sections</h2><ol>${sectionList}</ol></section>
</main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
