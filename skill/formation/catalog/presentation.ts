import type { CatalogDomainId, LaunchMatrixGroup, LaunchMatrixGroupId, WorkflowId } from "./types.js";

export const presentationGroups: readonly LaunchMatrixGroup[] = [
  {
    id: "market-product",
    title: "Market and product",
    description: "Prove the opportunity and define the product.",
    order: 1,
    domainIds: ["domain.research", "domain.product"],
  },
  {
    id: "experience-brand",
    title: "Experience and brand",
    description: "Shape the customer experience, design, and words.",
    order: 2,
    domainIds: ["domain.experience", "domain.design", "domain.words"],
  },
  {
    id: "build-measurement",
    title: "Build and measurement",
    description: "Build the product and make its behavior measurable.",
    order: 3,
    domainIds: ["domain.engineering", "domain.data"],
  },
  {
    id: "revenue-growth",
    title: "Revenue and growth",
    description: "Create the revenue model and repeatable demand.",
    order: 4,
    domainIds: ["domain.money", "domain.growth"],
  },
  {
    id: "release-trust",
    title: "Release and trust",
    description: "Prepare store release, security, privacy, and compliance proof.",
    order: 5,
    domainIds: ["domain.store", "domain.trust"],
  },
  {
    id: "operate-improve",
    title: "Operate and improve",
    description: "Run support, learn from results, and improve the business.",
    order: 6,
    domainIds: ["domain.operations"],
  },
];

const workflowOverrides: Partial<Record<WorkflowId, LaunchMatrixGroupId>> = {};

export function presentationGroupFor(workflowId: WorkflowId, domainId: CatalogDomainId): LaunchMatrixGroupId | undefined {
  const override = workflowOverrides[workflowId];
  if (override) return override;
  return presentationGroups.find((group) => group.domainIds.includes(domainId))?.id;
}
