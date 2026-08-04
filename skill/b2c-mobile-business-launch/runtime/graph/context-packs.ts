import type { ContextPackDefinition, DomainDefinition, ReferenceDefinition, ReferenceId } from "./types.js";

const strategies: Record<string, ContextPackDefinition["strategy"]> = {
  orchestration: "load-all",
  product: "select-one",
  experience: "progressive",
  design: "progressive",
  engineering: "progressive",
  store: "progressive",
  growth: "progressive",
  machine: "progressive",
};

const preferredEntries: Record<string, string[]> = {
  process: ["knowledge/process/launch-phases.md", "knowledge/process/launch-coverage.md"],
  orchestration: [
    "knowledge/orchestration/project-state.md",
    "knowledge/orchestration/autonomy-modes.md",
    "knowledge/orchestration/parallel-agent-orchestration.md",
  ],
  operations: ["knowledge/operations/founder-zero-operator.md", "knowledge/operations/frontier-agent-operations.md"],
  research: ["knowledge/research/localization-market-research.md"],
  product: [
    "knowledge/product/product-moat.md",
    "knowledge/product/social-network.md",
    "knowledge/product/ai-chat-companion.md",
    "knowledge/product/habit-tracker.md",
    "knowledge/product/photo-ai-media.md",
  ],
  experience: ["knowledge/experience/eleven-star-experience.md", "knowledge/experience/emotional-design-system.md"],
  design: ["knowledge/design/design-room.md", "knowledge/design/design-visual-system.md"],
  words: ["knowledge/words/no-slop-writing.md", "knowledge/words/conversion-copy.md"],
  engineering: ["knowledge/engineering/engineering-orchestration.md", "knowledge/engineering/backend-data-contract.md"],
  store: ["knowledge/store/aso-store-ops.md", "knowledge/store/store-console-workflow.md"],
  money: ["knowledge/money/revenue-monetization.md"],
  growth: ["knowledge/growth/paid-user-acquisition.md", "knowledge/growth/viral-growth-loops.md"],
  data: ["knowledge/data/analytics-attribution.md"],
  trust: ["knowledge/trust/security-release-hardening.md", "knowledge/trust/privacy-terms.md"],
  machine: ["validation/repository/skill-versioning.md", "validation/repository/launchbench-evals.md"],
};

export function buildContextPacks(domains: readonly DomainDefinition[], references: readonly ReferenceDefinition[]): ContextPackDefinition[] {
  return domains.map((domain) => {
    const domainReferences = references.filter((reference) => reference.domainId === domain.id);
    const index = domainReferences.find((reference) => reference.index);
    const preferred = new Set(preferredEntries[domain.slug] ?? []);
    let entries = domainReferences.filter((reference) => preferred.has(reference.path));
    if (entries.length === 0) entries = domainReferences.filter((reference) => !reference.index).slice(0, 1);

    return {
      id: `context.${domain.slug}`,
      name: `${domain.name} context`,
      domainId: domain.id,
      strategy: strategies[domain.slug] ?? "progressive",
      indexReferenceId: index?.id,
      entryReferenceIds: entries.map((reference) => reference.id),
      referenceIds: domainReferences.filter((reference) => !reference.index).map((reference) => reference.id),
      selectionRule:
        strategies[domain.slug] === "load-all"
          ? "Load the entry set together, then select any additional reference whose trigger matches."
          : strategies[domain.slug] === "select-one"
            ? "Select the one reference matching the product or task shape; do not preload alternatives."
            : "Load the index or primary entry first, then disclose only references whose load condition matches the current work.",
    } satisfies ContextPackDefinition;
  });
}

export function resolveReferenceId(references: readonly ReferenceDefinition[], path: string): ReferenceId | undefined {
  return references.find((reference) => reference.path === path)?.id;
}
