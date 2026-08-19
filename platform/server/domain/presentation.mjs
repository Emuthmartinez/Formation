/**
 * The board-ready presentation boundary.
 *
 * Every piece of skill- or system-authored text passes through this module before a founder
 * sees it. The founder is the founder — not an engineering architect, a marketer, or a store-ops
 * specialist — so the top level reads the way a chief of staff would present the item to the
 * board: what the work gives the company, and what is being asked. The skill's own wording is
 * never lost; it travels alongside as technical detail the founder can expand (design-system.md:
 * "Reveal system detail only when useful"). Founder-authored words are never rewritten.
 *
 * This is a shared capability: any surface that shows non-founder-authored text — run steps,
 * approval mirrors, blocker tasks, imported deliverables, activity entries — calls it. New
 * surfaces must route through here rather than passing skill vocabulary to the client
 * (platform/AGENTS.md).
 *
 * Translation order:
 *   1. A curated board-language table keyed by stable catalog workflow id — the honest,
 *      hand-written presentation of the known catalog.
 *   2. A conservative glossary scrub for unknown ids (whole-word specialist terms only).
 *   3. An optional AI polish pass when FORMATION_AI_PRESENTER_ENDPOINT is configured —
 *      schema-validated like the generation provider, cached by content, and falling back to
 *      the deterministic result on any non-conforming answer. Without the endpoint, the
 *      deterministic layers are the capability.
 */

/** What each known launch step gives the company, in board language. */
const BOARD_STEPS = Object.freeze({
  "workflow.operations.paid-tool-routing-and-fallback": {
    title: "Backup plans for paid tools",
    summary: "Keeps work moving when a paid service fails or runs out — any new spend comes to you first.",
  },
  "workflow.operations.secrets-baseline-and-routing": {
    title: "Account access and credential safety",
    summary: "Puts every account, key, and credential the business uses under controlled, auditable access.",
  },
  "workflow.trust.security-architecture-and-release-gate": {
    title: "Security review before release",
    summary: "An independent check that the product protects customer data before anything ships.",
  },
  "workflow.trust.privacy-and-terms": {
    title: "Privacy policy and terms of service",
    summary: "The legal documents customers agree to, drafted for your approval.",
  },
  "workflow.operations.resend-email-ops": {
    title: "Customer email delivery",
    summary: "Reliable delivery for receipts, sign-ins, and announcements.",
  },
  "workflow.operations.post-launch-operations": {
    title: "Running the business after launch",
    summary: "The operating rhythm once live: monitoring, support, and the kill, hold, fix, or scale call.",
  },
  "workflow.operations.founder-zero-operator-bootstrap": {
    title: "Day-one operating setup",
    summary: "Establishes who owns each business account and how work runs without you in the loop hourly.",
  },
  "workflow.operations.agent-operations-ledger": {
    title: "Record of actions taken on your behalf",
    summary: "A ledger of every authenticated action performed in your accounts, approved by you in advance.",
  },
  "workflow.product.app-archetype-detection-and-starter": {
    title: "Product foundation",
    summary: "Chooses the right starting structure for the product so build work compounds instead of restarting.",
  },
  "workflow.research.research-backed-spec": {
    title: "Market research and product case",
    summary: "Evidence on the market and customer, ending in a go, pivot, or kill recommendation.",
  },
  "workflow.research.localization-market-research": {
    title: "International market check",
    summary: "Which countries and languages are worth serving first.",
  },
  "workflow.experience.11-star-experience": {
    title: "Signature customer experience",
    summary: "Designs the moments that make customers tell their friends.",
  },
  "workflow.experience.emotional-experience-design-producer": {
    title: "Emotional design of the product",
    summary: "Shapes how the product should feel at each step of use.",
  },
  "workflow.experience.emotional-design-audit-auditor": {
    title: "Independent design review",
    summary: "A fresh-eyes audit of the designed experience before it hardens.",
  },
  "workflow.design.design-room-state-mutate-version-render": {
    title: "Brand and visual direction",
    summary: "The visual identity, iterated in reviewable versions until you approve the direction.",
  },
  "workflow.design.token-promotion": {
    title: "Design consistency system",
    summary: "Locks the approved look so every screen matches the brand.",
  },
  "workflow.design.ux-patterns-refero": {
    title: "Proven interface patterns",
    summary: "Applies interface patterns customers already understand.",
  },
  "workflow.experience.onboarding-conversion": {
    title: "First-use experience",
    summary: "The first minutes in the product, tuned so new customers reach value and stay.",
  },
  "workflow.design.premium-mobile-craft": {
    title: "Premium feel and polish",
    summary: "The detail work that makes the product feel worth paying for.",
  },
  "workflow.design.content-assets-remotion-generated-visuals": {
    title: "Marketing visuals and content",
    summary: "Produces the images and video the brand will publish.",
  },
  "workflow.words.writing-quality-no-slop": {
    title: "Writing quality",
    summary: "Holds every customer-facing sentence to a human standard.",
  },
  "workflow.store.aso-and-store-ops": {
    title: "App store visibility",
    summary: "How the product gets found and chosen in the store.",
  },
  "workflow.store.app-store-listing-prep-packet": {
    title: "Store listing",
    summary: "The public product page: name, story, and positioning.",
  },
  "workflow.store.apple-signing-and-release-readiness": {
    title: "Apple release readiness",
    summary: "Everything Apple requires to ship, prepared for your sign-off.",
  },
  "workflow.store.apple-app-store-requirements-privacy-manifest": {
    title: "Apple privacy requirements",
    summary: "The privacy answers Apple publishes alongside the product.",
  },
  "workflow.store.store-console-workflow": {
    title: "Store account operations",
    summary: "Work performed inside the store accounts you own, with your approval.",
  },
  "workflow.store.asc-cli-automation": {
    title: "App Store submission automation",
    summary: "Automates the submission paperwork with Apple.",
  },
  "workflow.store.store-screenshots-production": {
    title: "Store screenshots",
    summary: "The screenshots customers see before choosing to install.",
  },
  "workflow.store.google-play-release": {
    title: "Google Play release",
    summary: "Ships the Android version through Google's store.",
  },
  "workflow.engineering.engineering-orchestration-ce-production-readiness": {
    title: "Engineering delivery and production readiness",
    summary: "Builds the product to a standard fit for real customers.",
  },
  "workflow.engineering.backend-data-contract": {
    title: "Customer data foundations",
    summary: "The systems of record for accounts, content, and payments.",
  },
  "workflow.engineering.app-agent-roster-and-repo-entrypoints": {
    title: "Engineering team setup",
    summary: "Organizes the build system so work stays fast and safe.",
  },
  "workflow.engineering.mobai-device-automation-and-demo-videos": {
    title: "Automated product testing and demos",
    summary: "Exercises the product on real devices and records demo footage.",
  },
  "workflow.engineering.native-ios-proof-route-ladder": {
    title: "iPhone build verification",
    summary: "Proves the product runs cleanly end to end on iPhone.",
  },
  "workflow.data.analytics-and-attribution-blueprint": {
    title: "Business measurement",
    summary: "Defines the numbers that tell you whether the business is working, and wires them up.",
  },
  "workflow.growth.paid-user-acquisition-system": {
    title: "Paid customer acquisition",
    summary: "Advertising that buys customers profitably — spend moves only with your approval.",
  },
  "workflow.growth.viral-growth-loop": {
    title: "Word-of-mouth growth",
    summary: "Product mechanics that turn customers into referrers.",
  },
  "workflow.growth.launch-narrative-and-cadence": {
    title: "Launch announcement plan",
    summary: "What the company says publicly at launch, and when.",
  },
  "workflow.money.revenue-monetization": {
    title: "Pricing and revenue",
    summary: "What customers pay and how revenue is collected — priced with your approval.",
  },
  "workflow.growth.geo-seo-public-visibility": {
    title: "Public web presence",
    summary: "Makes the business findable by the people and AI assistants searching for it.",
  },
  "workflow.growth.pre-launch-funnel-landing-waitlist": {
    title: "Pre-launch waitlist",
    summary: "A public page collecting interested customers before launch.",
  },
  "workflow.growth.ugc-creator-engine": {
    title: "Creator marketing",
    summary: "Recruits creators to make content that sells the product.",
  },
  "workflow.growth.fastlane-growth-ops": {
    title: "Social media operations",
    summary: "Runs the accounts and posting schedule — nothing posts without your approval.",
  },
  // Cross-cutting launch-integrity work (the skill checking its own work). These never join a
  // founder work area, but their outcomes are readiness evidence, so they present by name.
  "workflow.orchestration.session-continuity-resume": {
    title: "Continuity between work sessions",
    summary: "Each session picks up exactly where the last one stopped, from durable records.",
  },
  "workflow.orchestration.orient-scaffold-and-state-cockpit-upkeep": {
    title: "Business records and status upkeep",
    summary: "Keeps the company's operating records and status view current.",
  },
  "workflow.process.provider-proof-verification": {
    title: "Live checks on business services",
    summary: "Confirms payments, analytics, email, and store connections with live evidence before they count as done.",
  },
  "workflow.process.change-cascade": {
    title: "Keeping public surfaces consistent",
    summary: "When the product changes, every page, listing, and document that mentions it is updated to match.",
  },
  "workflow.process.launch-trace-and-build-contracts": {
    title: "Traceability from research to build",
    summary: "Keeps the record of how research decisions became the product being built.",
  },
  "workflow.process.business-control-plane-extension": {
    title: "Workspace dashboard extensions",
    summary: "Adds new panels to your business workspace as the launch grows.",
  },
  "workflow.process.launchbench-failure-cards-coverage-audit": {
    title: "Launch completeness audit",
    summary: "An independent audit that nothing on the launch checklist was silently skipped.",
  },
});

/** The skill's short approval asks, restated as what the founder is actually deciding. */
const BOARD_ASKS = Object.freeze({
  "approve a paid or constrained fallback": "Approve paying for a backup tool so work keeps moving.",
  "provide or authorize credentials": "Grant the team access to an account it needs.",
  "accept residual security risk": "Accept or reject the remaining security risk before release.",
  "approve legal text": "Approve the privacy policy and terms your customers will agree to.",
  "decide Kill, Hold, Fix, or Scale": "Make the call: kill, hold, fix, or scale.",
  "provide account ownership decisions": "Decide who owns which business accounts.",
  "approve exact authenticated actions": "Approve the specific actions the team may take inside your accounts.",
  "decide Go, Pivot, or Kill": "Make the call: go, pivot, or kill.",
  "approve final brand direction": "Approve the final brand direction.",
  "approve signing and submission": "Approve submitting the product to Apple.",
  "approve privacy answers": "Approve the privacy disclosures Apple will publish.",
  "approve external console mutations": "Approve the changes to be made inside your store accounts.",
  "approve App Store Connect mutations": "Approve the changes to your App Store account.",
  "approve Play Console release": "Approve the Google Play release.",
  "approve ad-account access and spend": "Approve advertising access and budget.",
  "approve public launch posting": "Approve the public launch announcement.",
  "approve pricing and product catalog": "Approve the pricing and what is offered for sale.",
  "approve social connections and scheduled posts": "Approve connecting social accounts and the posting schedule.",
});

/** Category fallbacks when an ask isn't in the table — what saying yes means. */
const CATEGORY_ASKS = Object.freeze({
  spend: "Give your go-ahead on a step that spends money.",
  credentials_access: "Give your go-ahead on a step that uses accounts you control.",
  legal_pricing: "Give your go-ahead on a step that touches legal terms or pricing.",
  public_actions: "Give your go-ahead on a step that acts in public for the company.",
  release: "Give your go-ahead on a step that ships a release.",
  destructive: "Give your go-ahead on a step that is hard to undo.",
});

/**
 * Conservative whole-word scrub for titles that miss the table. It removes tool and trade
 * jargon a founder should not need; anything it cannot confidently soften stays as-is (the
 * original always survives in technical detail).
 */
const GLOSSARY = [
  [/\bASC CLI\b/g, "App Store submission"],
  [/\bCLI\b/g, "automation"],
  [/\bASO\b/g, "store visibility"],
  [/\bGEO\/SEO\b/g, "search visibility"],
  [/\bSEO\b/g, "search visibility"],
  [/\bUGC\b/g, "creator content"],
  [/\bAPI\b/g, "integration"],
  [/\brepo\b/gi, "codebase"],
  [/\bbackend\b/gi, "core systems"],
  [/\bops\b/g, "operations"],
  [/\s*\((?:producer|auditor)\)/gi, ""],
];

function scrubTitle(title) {
  let output = title;
  for (const [pattern, replacement] of GLOSSARY) output = output.replace(pattern, replacement);
  return output.replace(/\s{2,}/g, " ").trim();
}

/**
 * Board presentation of one launch step. Returns { title, summary, technical } where
 * `technical` is the skill's own title when it differs from the board title, else null.
 */
export function presentStep(workflowId, engineTitle) {
  const known = BOARD_STEPS[workflowId];
  if (known) {
    return {
      title: known.title,
      summary: known.summary,
      technical: engineTitle && engineTitle !== known.title ? engineTitle : null,
    };
  }
  const scrubbed = engineTitle ? scrubTitle(engineTitle) : "Launch work";
  return {
    title: scrubbed,
    summary: null,
    technical: engineTitle && engineTitle !== scrubbed ? engineTitle : null,
  };
}

/** The board title alone — for prose that names a step. */
export function boardStepTitle(workflowId, engineTitle) {
  return presentStep(workflowId, engineTitle).title;
}

const SERVICE_ACCESS = Object.freeze({
  planned: "Setup planned",
  connected: "Access available",
  verified: "Access proven",
  unavailable: "Not available",
  blocked: "Needs attention",
});

/** Founder-safe service copy. Raw skill fields remain available only as technical detail. */
export function presentMatrixService(service, workTitle) {
  return {
    name: scrubTitle(service.name || "Business service"),
    purpose: `Helps complete ${workTitle}.`,
    access: SERVICE_ACCESS[service.state] ?? "Access not checked",
    ...(service.checkedAt ? { checkedAt: service.checkedAt } : {}),
    technical: { id: service.id, state: service.state, purpose: service.purpose },
  };
}

/**
 * Founder-safe knowledge-guide copy. The skill's load_when trigger is written for agents
 * deciding what to read, not for founders — it names files, checks, and routing hubs — so it
 * never crosses at the top level. The guide presents as what it is to the founder: the playbook
 * behind this work, with a plain freshness verdict. Raw id, document path, and the agent-facing
 * trigger survive as technical detail.
 */
export function presentMatrixKnowledge(guide, workTitle) {
  const freshness =
    guide.reviewStatus === "review-due"
      ? "A source check is due"
      : guide.freshness === "internal"
        ? "Maintained with the product"
        : guide.freshness && guide.freshness.startsWith("reviewed ")
          ? `Sources checked ${guide.freshness.slice("reviewed ".length)}`
          : "Freshness not reported";
  return {
    name: scrubTitle(guide.title || "Working guide"),
    purpose: `The playbook the team follows for ${workTitle}.`,
    freshness,
    ...(guide.reviewStatus ? { reviewStatus: guide.reviewStatus } : {}),
    ...(guide.packTitle ? { packTitle: scrubTitle(guide.packTitle) } : {}),
    technical: { id: guide.id, path: guide.path, loadWhen: guide.loadWhen },
  };
}

/** Founder-safe specialist capability copy. Internal routes remain in technical detail. */
export function presentMatrixTool(tool, workTitle) {
  const id = String(tool.id ?? "").toLowerCase();
  const name = /image|visual|design|motion|video/.test(id)
    ? "Visual production support"
    : /device|mobile|xcode|ios|android|simulator/.test(id)
      ? "Device testing support"
      : /research|search|market/.test(id)
        ? "Research support"
        : /analytics|measure|data/.test(id)
          ? "Measurement support"
          : "Specialist support";
  return {
    name,
    purpose: `Helps the team complete ${workTitle}.`,
    technical: { id: tool.id, when: tool.when },
  };
}

/**
 * Board presentation of one skill approval: what the founder is deciding, in one sentence.
 * The skill's raw ask survives in the mirrored decision's `source` for technical disclosure.
 */
export function presentApprovalAsk(description, protectedCategory) {
  if (description && BOARD_ASKS[description]) return BOARD_ASKS[description];
  if (protectedCategory && CATEGORY_ASKS[protectedCategory]) return CATEGORY_ASKS[protectedCategory];
  return "Give your go-ahead so this step can continue.";
}

/**
 * Optional AI polish. When FORMATION_AI_PRESENTER_ENDPOINT is set, unknown text can be sent for
 * a board-language rewrite under a strict response contract ({"board": string}), cached by
 * content so each unique text is translated once per process. Any failure, timeout, or
 * non-conforming answer falls back to the deterministic input — the presenter can only improve
 * copy, never block or degrade a surface.
 */
const polishCache = new Map();

export async function polishForBoard(text, context = "") {
  const endpoint = process.env.FORMATION_AI_PRESENTER_ENDPOINT;
  if (!endpoint || !text) return text;
  const key = `${context}\u0000${text}`;
  if (polishCache.has(key)) return polishCache.get(key);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.FORMATION_AI_API_KEY ? { authorization: `Bearer ${process.env.FORMATION_AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        task: "board-presentation",
        instruction:
          "Rewrite the text for a company founder as if presenting to the board: plain business language, no engineering, marketing, or tooling jargon, one or two sentences, no invented facts. Respond with JSON: {\"board\": string}.",
        context,
        text,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`presenter answered ${response.status}`);
    const payload = await response.json();
    const board = typeof payload?.board === "string" ? payload.board.trim() : "";
    const result = board.length > 0 && board.length <= 500 ? board : text;
    polishCache.set(key, result);
    return result;
  } catch {
    polishCache.set(key, text);
    return text;
  }
}
