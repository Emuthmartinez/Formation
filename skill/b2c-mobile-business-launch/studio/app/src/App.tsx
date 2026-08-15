import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import type { BusinessState, ThemeTokens } from "./types";

interface LoadState {
  business?: BusinessState;
  tokens?: ThemeTokens;
  error?: string;
}

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({});
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    Promise.all([
      fetch("./state/business.json").then((response) => response.json() as Promise<BusinessState>),
      fetch("./state/theme.tokens.json").then((response) => response.json() as Promise<ThemeTokens>),
    ])
      .then(([business, tokens]) => {
        setLoadState({ business, tokens });
        applyTokens(tokens);
      })
      .catch((error: unknown) => {
        setLoadState({ error: error instanceof Error ? error.message : String(error) });
      });
  }, []);

  if (loadState.error) {
    return <main className="shell">Design Room failed to load: {loadState.error}</main>;
  }

  // AnimatePresence cross-fades skeleton -> Design Room so a re-render after a state
  // mutation reads as "state changed". framer-motion lives only in this web preview;
  // the shipped iOS/Flutter app consumes the same motion scale via DesignTokens.swift.
  return (
    <AnimatePresence mode="wait">
      {!loadState.business || !loadState.tokens ? (
        <motion.main
          key="loading"
          className="shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionFor(reduceMotion)}
        >
          Loading Design Room...
        </motion.main>
      ) : (
        <DesignRoom key="room" business={loadState.business} tokens={loadState.tokens} reduceMotion={Boolean(reduceMotion)} />
      )}
    </AnimatePresence>
  );
}

function DesignRoom({ business, tokens, reduceMotion }: { business: BusinessState; tokens: ThemeTokens; reduceMotion: boolean }) {
  const summaries = useMemo(() => {
    const appStore = business.surfaces.appStore;
    return [
      ["Web funnels", business.surfaces.webFunnels.length],
      ["Landing pages", business.surfaces.landingPages.length],
      ["Marketing assets", business.surfaces.marketingAssets.length],
      ["App screens", business.surfaces.mobileApp.screens.length],
      ["App flows", business.surfaces.mobileApp.flows.length],
      ["Custom product pages", appStore.customProductPages.length],
      ["PPO tests", appStore.productPageOptimizationTests.length],
      ["In-App Events", appStore.inAppEvents.length],
    ] as const;
  }, [business]);
  const latest = business.designRoom.versionLog.at(-1);

  const base = msToSeconds(tokens.tokens.motion?.durationBase, 0.22);
  const stagger = reduceMotion ? 0 : 0.05;
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger } },
  };
  const item: Variants = reduceMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
  const itemTransition = transitionFor(reduceMotion, base);
  const tap = reduceMotion ? undefined : { scale: 0.985 };

  return (
    <motion.main className="shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transitionFor(reduceMotion, base)}>
      <header className="hero">
        <p className="eyebrow">Design Room</p>
        <h1>{business.business.name}</h1>
        <div className="pills">
          <span>Stage: {business.business.stage}</span>
          <span>Theme: {business.theme.status}</span>
          <span>Updated: {business.updatedAt}</span>
        </div>
      </header>

      <section className="grid two">
        <article className="panel">
          <p className="eyebrow">Positioning</p>
          <h2>{business.business.positioning || "Positioning not defined"}</h2>
        </article>
        <article className="panel">
          <p className="eyebrow">Audience</p>
          <h2>{business.business.targetAudience || "Audience not defined"}</h2>
        </article>
      </section>

      {business.designBrief ? (
        <motion.section
          className="panel"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionFor(reduceMotion, base)}
        >
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Design Brief</p>
              <h2>{business.designBrief.recommendedStyle || "Style not set"}</h2>
            </div>
          </div>
          {business.designBrief.paletteMood ? (
            <p>
              <strong>Palette:</strong> {business.designBrief.paletteMood}
            </p>
          ) : null}
          {business.designBrief.typographyMood ? (
            <p>
              <strong>Type:</strong> {business.designBrief.typographyMood}
            </p>
          ) : null}
          {business.designBrief.keyEffects && business.designBrief.keyEffects.length > 0 ? (
            <div className="pills">
              {business.designBrief.keyEffects.map((effect) => (
                <span key={effect}>{effect}</span>
              ))}
            </div>
          ) : null}
          {business.designBrief.source ? (
            <details className="techDetails">
              <summary>Technical details</summary>
              <p>Style research source: {business.designBrief.source}</p>
            </details>
          ) : null}
        </motion.section>
      ) : null}

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Surface Model</p>
            <h2>Cross-surface state</h2>
          </div>
          <span className="stamp">Every screen and page below stays in sync automatically</span>
        </div>
        <motion.div className="metrics" variants={container} initial="hidden" animate="visible">
          {summaries.map(([label, count]) => (
            <motion.article key={label} className="metric" variants={item} transition={itemTransition} whileTap={tap}>
              <span>{label}</span>
              <strong>{count}</strong>
            </motion.article>
          ))}
        </motion.div>
      </section>

      <section className="grid three">
        <article className="panel">
          <p className="eyebrow">Custom Product Pages</p>
          <h2>{business.surfaces.appStore.customProductPages.length} / 70</h2>
          <p>Each page should carry audience, traffic source, media, keywords, URL, and measurement plan.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">PPO Tests</p>
          <h2>{business.surfaces.appStore.productPageOptimizationTests.length}</h2>
          <p>Tests model alternate app icons, screenshots, and app previews only.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">In-App Events</p>
          <h2>{business.surfaces.appStore.inAppEvents.length} / 15</h2>
          <p>Events must represent real time-bound in-app content with review-ready media.</p>
        </article>
      </section>

      <section className="grid two">
        <article className="panel">
          <p className="eyebrow">Latest Mutation</p>
          <h2>{latest?.summary ?? "No mutation recorded"}</h2>
          <p>{latest?.createdAt ?? ""}</p>
          <p>
            <strong>Design contract:</strong> {business.designRoom.contractPath}
          </p>
        </article>
        <article className="panel tokenPanel">
          <p className="eyebrow">Colors</p>
          {Object.entries(tokens.tokens.color)
            .slice(0, 8)
            .map(([name, value]) => (
              <span key={name} className="swatch" style={{ ["--swatch" as string]: value }}>
                {toLabel(name)}
              </span>
            ))}
        </article>
      </section>
    </motion.main>
  );
}

function applyTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokens.tokens.color)) {
    root.style.setProperty(`--color-${toKebab(name)}`, value);
  }
  for (const [name, value] of Object.entries(tokens.tokens.radius)) {
    root.style.setProperty(`--radius-${toKebab(name)}`, value);
  }
  for (const [name, value] of Object.entries(tokens.tokens.space)) {
    root.style.setProperty(`--space-${toKebab(name)}`, value);
  }
  root.style.setProperty("--font-display", tokens.tokens.font.display.family);
  root.style.setProperty("--font-body", tokens.tokens.font.body.family);

  // Inject the tokenized motion scale so every animation in the preview (and any
  // landing/funnel surface built on these tokens) reads from one source of truth.
  // Names mirror promote-design-tokens.ts so the runtime preview matches design-system/tokens.css.
  const motionTokens = tokens.tokens.motion ?? {};
  const motionVars: Array<readonly [string, string | undefined]> = [
    ["--motion-duration-fast", motionTokens.durationFast],
    ["--motion-duration-base", motionTokens.durationBase],
    ["--motion-duration-slow", motionTokens.durationSlow],
    ["--motion-duration-reduced", motionTokens.reducedMotionDuration],
    ["--motion-easing", motionTokens.easing],
  ];
  for (const [name, value] of motionVars) {
    if (value) {
      root.style.setProperty(name, value);
    }
  }
}

function transitionFor(reduceMotion: boolean | null, durationSeconds = 0.22) {
  return { duration: reduceMotion ? 0 : durationSeconds, ease: [0.2, 0, 0, 1] as const };
}

function msToSeconds(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const milliseconds = Number.parseFloat(value.replace(/ms$/i, ""));
  return Number.isFinite(milliseconds) ? milliseconds / 1000 : fallback;
}

function toKebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/** Turns a camelCase token key (e.g. "surfaceElevated") into a plain label ("Surface elevated") for founder-facing display. */
function toLabel(value: string) {
  const spaced = value.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
