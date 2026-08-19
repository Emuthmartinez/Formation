#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getToken, loadDesignState, parseDesignCliArgs, rel, skillRoot, summarizeSurfaces } from "./lib/design-state.js";
import { panelBlurb, panelLabel } from "./lib/founder-copy.js";
import { escapeHtml } from "./lib/html.js";
import { asArray, asString, isRecord, reportAndExit } from "./lib/launch-state.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const loaded = loadDesignState(args);

if (!loaded.state || !loaded.tokens || !loaded.stateHash) {
  reportAndExit("Design Room render", loaded.issues);
  process.exit();
}

const outputPath = args.outputPath ?? path.join(args.root, "design/design-room.html");
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, renderStaticHtml(loaded.state, loaded.tokens, loaded.stateHash), "utf8");
console.log(`Design Room static HTML written to ${rel(args.root, outputPath)}`);

if (!args.staticOnly) {
  const distPath = args.distPath ?? path.join(args.root, "dist/design-room");
  const viteBin = resolveViteBin();
  if (viteBin) {
    const result = spawnSync(viteBin, ["build", "--config", path.join(skillRoot, "studio/app/vite.config.ts"), "--outDir", distPath], {
      cwd: skillRoot,
      encoding: "utf8",
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (result.error || result.status !== 0) {
      loaded.issues.push({
        severity: "error",
        code: "design_room.vite_build_failed",
        message: result.error?.message ?? `vite build exited with status ${result.status ?? "unknown"}`,
      });
    } else {
      const distStateDir = path.join(distPath, "state");
      rmSync(distStateDir, { recursive: true, force: true });
      mkdirSync(distStateDir, { recursive: true });
      cpSync(args.statePath, path.join(distStateDir, "business.json"));
      cpSync(args.tokensPath, path.join(distStateDir, "theme.tokens.json"));
      writeFileSync(path.join(distStateDir, "hash.txt"), `${loaded.stateHash}\n`, "utf8");
      console.log(`Design Room Vite build written to ${rel(args.root, distPath)}`);
    }
  } else {
    loaded.issues.push({
      severity: "warning",
      code: "design_room.vite_missing",
      message: "Vite is not installed; wrote the static HTML fallback only.",
    });
  }
}

reportAndExit("Design Room render", loaded.issues);

function resolveViteBin(): string | undefined {
  const candidates = [path.join(skillRoot, "node_modules/.bin/vite"), path.resolve(skillRoot, "../..", "node_modules/.bin/vite")];
  return candidates.find((candidate) => existsSync(candidate));
}

/**
 * Founder translation for control-plane panels. The Design Room is text a
 * founder reads, so panel rows carry plain-language labels and blurbs; the
 * machine reads/renders detail moves into the technical-details disclosure
 * (check:founder-copy enforces both halves of that split). The labels themselves
 * come from the shared founder-copy layer, not from here.
 */
function founderPanelCopy(id: string, name: string): { label: string; blurb: string } {
  return { label: panelLabel(id, name), blurb: panelBlurb(id) };
}

function renderStaticHtml(state: unknown, tokens: unknown, stateHash: string): string {
  const business = isRecord(state) && isRecord(state.business) ? state.business : {};
  const designBrief = isRecord(state) && isRecord(state.designBrief) ? state.designBrief : undefined;
  const designRoom = isRecord(state) && isRecord(state.designRoom) ? state.designRoom : {};
  const contractPath = asString(designRoom.contractPath) ?? "design/design.md";
  const appStore = isRecord(state) && isRecord(state.surfaces) && isRecord(state.surfaces.appStore) ? state.surfaces.appStore : {};
  const controlPlane = isRecord(state) && isRecord(state.controlPlane) ? state.controlPlane : {};
  const latestVersion = asArray(designRoom.versionLog).at(-1);
  const summaries = summarizeSurfaces(state);
  const customPages = asArray(appStore.customProductPages);
  const ppoTests = asArray(appStore.productPageOptimizationTests);
  const inAppEvents = asArray(appStore.inAppEvents);
  const panels = asArray(controlPlane.panels).filter(isRecord);

  const surfaceCards = summaries
    .map(
      (summary) => `<article class="metric">
        <span>${escapeHtml(summary.label)}</span>
        <strong>${summary.count}</strong>
        <small>${summary.ready} ready / ${summary.blocked} blocked / ${summary.notStarted} draft</small>
      </article>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="design-state-hash" content="${escapeHtml(stateHash)}" />
  <meta name="design-contract-path" content="${escapeHtml(contractPath)}" />
  <title>${escapeHtml(business.name ?? "App")} Design Room</title>
  <style>
    :root {
      --color-background: ${cssToken(tokens, "color.background")};
      --color-surface: ${cssToken(tokens, "color.surface")};
      --color-surface-elevated: ${cssToken(tokens, "color.surfaceElevated")};
      --color-primary: ${cssToken(tokens, "color.primary")};
      --color-accent: ${cssToken(tokens, "color.accent")};
      --color-text: ${cssToken(tokens, "color.text")};
      --color-muted: ${cssToken(tokens, "color.muted")};
      --color-border: ${cssToken(tokens, "color.border")};
      --font-display: ${cssToken(tokens, "font.display.family")};
      --font-body: ${cssToken(tokens, "font.body.family")};
      --radius-md: ${cssToken(tokens, "radius.md")};
      --space-md: ${cssToken(tokens, "space.md")};
      --space-lg: ${cssToken(tokens, "space.lg")};
      --motion-duration-fast: ${cssToken(tokens, "motion.durationFast")};
      --motion-duration-base: ${cssToken(tokens, "motion.durationBase")};
      --motion-easing: ${cssToken(tokens, "motion.easing")};
    }
    @media (prefers-reduced-motion: no-preference) {
      .deck .metric { animation: design-room-rise var(--motion-duration-base, 220ms) var(--motion-easing, ease) both; }
    }
    @keyframes design-room-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 28%),
        linear-gradient(135deg, var(--color-background), color-mix(in srgb, var(--color-primary) 12%, var(--color-background)));
      color: var(--color-text);
      font: 15px/1.45 var(--font-body);
    }
    header { padding: 36px clamp(18px, 5vw, 56px) 28px; border-bottom: 1px solid var(--color-border); }
    h1 { margin: 0; font: 700 clamp(36px, 8vw, 84px)/0.92 var(--font-display); letter-spacing: 0; max-width: 900px; }
    h2 { margin: 0 0 14px; font: 700 22px/1.1 var(--font-display); letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 15px; }
    p { margin: 0; }
    main { display: grid; gap: 18px; padding: 24px clamp(18px, 5vw, 56px) 56px; }
    section { background: color-mix(in srgb, var(--color-surface) 94%, white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 18px; overflow: hidden; }
    .deck { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
    .metric, .panel { border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-elevated); padding: 14px; min-height: 104px; }
    .metric span, .eyebrow { color: var(--color-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .metric strong { display: block; font-size: 32px; line-height: 1; margin: 8px 0; }
    .metric small, .muted { color: var(--color-muted); }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .pill { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: 999px; padding: 7px 10px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .list { display: grid; gap: 10px; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; border-bottom: 1px solid var(--color-border); padding: 10px 0; }
    .row:last-child { border-bottom: 0; }
    .status { color: var(--color-primary); font-weight: 700; }
    @media (max-width: 680px) { .row { grid-template-columns: 1fr; } }
    details.techDetails { border: 1px dashed var(--color-border); background: transparent; }
    details.techDetails summary { cursor: pointer; color: var(--color-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    details.techDetails p { margin-top: 8px; color: var(--color-muted); font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Design Room</p>
    <h1>${escapeHtml(business.name ?? "Untitled app")}</h1>
    <div class="meta">
      <span class="pill">Stage: ${escapeHtml(business.stage ?? "unknown")}</span>
      <span class="pill">Theme: ${escapeHtml(isRecord(state) && isRecord(state.theme) ? state.theme.status : "unknown")}</span>
    </div>
  </header>
  <main>
    <section>
      <h2>Business Frame</h2>
      <div class="grid">
        <article class="panel"><h3>Positioning</h3><p>${escapeHtml(business.positioning ?? "") || '<span class="muted">Not defined</span>'}</p></article>
        <article class="panel"><h3>Audience</h3><p>${escapeHtml(business.targetAudience ?? "") || '<span class="muted">Not defined</span>'}</p></article>
        <article class="panel"><h3>Latest Mutation</h3><p>${escapeHtml(isRecord(latestVersion) ? latestVersion.summary : "No mutation recorded")}</p></article>
        <article class="panel"><h3>Design Contract</h3><p>${escapeHtml(contractPath)}</p><p class="muted">The contract explains the intent. State and tokens hold the exact values.</p></article>
      </div>
    </section>
    ${
      designBrief
        ? `<section>
      <h2>Design Brief</h2>
      <p class="muted">Web surfaces animate with framer-motion from motion.* tokens; mobile uses native animation.</p>
      <div class="grid">
        <article class="panel"><h3>Style</h3><p>${escapeHtml(designBrief.recommendedStyle) || '<span class="muted">Not set</span>'}</p></article>
        <article class="panel"><h3>Palette</h3><p>${escapeHtml(designBrief.paletteMood) || '<span class="muted">Not set</span>'}</p></article>
        <article class="panel"><h3>Typography</h3><p>${escapeHtml(designBrief.typographyMood) || '<span class="muted">Not set</span>'}</p></article>
      </div>
    </section>`
        : ""
    }
    <section>
      <h2>Surface Coverage</h2>
      <div class="deck">${surfaceCards}</div>
    </section>
    <section>
      <h2>Your business dashboard</h2>
      <div class="list">
        ${panels
          .map((panel) => {
            const copy = founderPanelCopy(asString(panel.id) ?? "", asString(panel.name) ?? "");
            return `<article class="row">
              <div>
                <h3>${escapeHtml(copy.label)}</h3>
                <p class="muted">${escapeHtml(copy.blurb)}</p>
              </div>
              <span class="status">${escapeHtml(panel.status ?? "unknown")}</span>
            </article>`;
          })
          .join("")}
      </div>
    </section>
    <section>
      <h2>App Store Marketing</h2>
      <div class="grid">
        <article class="panel"><h3>Custom Product Pages</h3><p>${customPages.length} / 70 planned</p><p class="muted">Each page needs an audience, traffic source, media, keywords, URL, and measurement reason.</p></article>
        <article class="panel"><h3>PPO Tests</h3><p>${ppoTests.length} planned</p><p class="muted">Treatments are limited to alternate icon, screenshots, and app previews.</p></article>
        <article class="panel"><h3>In-App Events</h3><p>${inAppEvents.length} / 15 approved slots modeled</p><p class="muted">Only real timed in-app content belongs here.</p></article>
      </div>
    </section>
    <section>
      <h2>Colors</h2>
      <div class="deck">
        ${(
          [
            ["Background", "color.background"],
            ["Primary", "color.primary"],
            ["Accent", "color.accent"],
            ["Text", "color.text"],
            ["Border", "color.border"],
          ] as const
        )
          .map(
            ([label, tokenPath]) =>
              `<article class="metric"><span>${escapeHtml(label)}</span><strong style="font-size:18px">${escapeHtml(String(getToken(tokens, tokenPath) ?? ""))}</strong></article>`,
          )
          .join("")}
      </div>
    </section>
    <details class="techDetails">
      <summary>Technical details</summary>
      <p>State hash: ${escapeHtml(stateHash)}</p>
      ${designBrief ? `<p>Design brief source: ${escapeHtml(designBrief.source)}</p>\n      ` : ""}${panels
        .map((panel) => {
          const copy = founderPanelCopy(asString(panel.id) ?? "", asString(panel.name) ?? "");
          const stateRefs = asArray(panel.stateRefs)
            .map((entry) => asString(entry))
            .filter(Boolean);
          const artifacts = asArray(panel.renderedArtifacts)
            .map((entry) => asString(entry))
            .filter(Boolean);
          return `<p>${escapeHtml(copy.label)}: reads ${escapeHtml(stateRefs.join(", ") || "no state refs")} and renders ${escapeHtml(artifacts.join(", ") || "no artifacts")}.</p>`;
        })
        .join("\n      ")}
    </details>
  </main>
</body>
</html>
`;
}

function cssToken(tokens: unknown, tokenPath: string): string {
  return String(getToken(tokens, tokenPath) ?? "initial");
}
