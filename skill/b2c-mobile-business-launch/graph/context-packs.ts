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
  process: ["playbook/process/launch-phases.md", "playbook/process/launch-coverage.md"],
  orchestration: [
    "playbook/orchestration/project-state.md",
    "playbook/orchestration/autonomy-modes.md",
    "playbook/orchestration/parallel-agent-orchestration.md",
  ],
  operations: ["playbook/operations/founder-zero-operator.md", "playbook/operations/frontier-agent-operations.md"],
  research: ["playbook/research/localization-market-research.md"],
  product: [
    "playbook/product/product-moat.md",
    "playbook/product/social-network.md",
    "playbook/product/ai-chat-companion.md",
    "playbook/product/habit-tracker.md",
    "playbook/product/photo-ai-media.md",
  ],
  experience: ["playbook/experience/eleven-star-experience.md", "playbook/experience/emotional-design-system.md"],
  design: ["playbook/design/design-room.md", "playbook/design/design-visual-system.md"],
  words: ["playbook/words/no-slop-writing.md", "playbook/words/conversion-copy.md"],
  engineering: ["playbook/engineering/engineering-orchestration.md", "playbook/engineering/backend-data-contract.md"],
  store: ["playbook/store/aso-store-ops.md", "playbook/store/store-console-workflow.md"],
  money: ["playbook/money/revenue-monetization.md"],
  growth: ["playbook/growth/paid-user-acquisition.md", "playbook/growth/viral-growth-loops.md"],
  data: ["playbook/data/analytics-attribution.md"],
  trust: ["playbook/trust/security-release-hardening.md", "playbook/trust/privacy-terms.md"],
  machine: ["machine/skill-versioning.md", "machine/launchbench-evals.md"],
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
