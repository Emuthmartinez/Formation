#!/usr/bin/env node
/**
 * Thin entrypoint for the validator fixture suite.
 *
 * The shared harness lives in machine/fixtures/_harness.ts and the fixtures
 * themselves are grouped into domain modules under machine/fixtures/. Modules
 * are registered in sequence so the PASS/FAIL output order is stable.
 *
 * Flags:
 *   --keep-temp  Keep the temp fixture root instead of deleting it (prints the path).
 */
import { createHarness, reportResults } from "./fixtures/_harness.js";
import { register as registerStateAndMeta } from "./fixtures/state-and-meta.fixtures.js";
import { register as registerProvidersAndSecrets } from "./fixtures/providers-and-secrets.fixtures.js";
import { register as registerStore } from "./fixtures/store.fixtures.js";
import { register as registerDesign } from "./fixtures/design.fixtures.js";
import { register as registerGrowth } from "./fixtures/growth.fixtures.js";
import { register as registerEngineering } from "./fixtures/engineering.fixtures.js";
import { register as registerLifecycle } from "./fixtures/lifecycle.fixtures.js";
import { register as registerProbesAndGrading } from "./fixtures/probes-and-grading.fixtures.js";
import { register as registerHooks } from "./fixtures/hooks.fixtures.js";
import { register as registerRepoGates } from "./fixtures/repo-gates.fixtures.js";
import { register as registerCoreArtifacts } from "./fixtures/core-artifacts.fixtures.js";
import { register as registerArchetype } from "./fixtures/archetype.fixtures.js";
import { register as registerBehavioral } from "./fixtures/behavioral.fixtures.js";
import { register as registerAgentOperations } from "./fixtures/agent-operations.fixtures.js";
import { register as registerFounderOperator } from "./fixtures/founder-operator.fixtures.js";
import { register as registerMobai } from "./fixtures/mobai.fixtures.js";
import { register as registerCopy } from "./fixtures/copy.fixtures.js";

const keepTemp = process.argv.includes("--keep-temp");
const harness = createHarness();

try {
  for (const register of [
    registerStateAndMeta,
    registerProvidersAndSecrets,
    registerStore,
    registerDesign,
    registerGrowth,
    registerEngineering,
    registerLifecycle,
    registerProbesAndGrading,
    registerHooks,
    registerRepoGates,
    registerCoreArtifacts,
    registerArchetype,
    registerBehavioral,
    registerAgentOperations,
    registerFounderOperator,
    registerMobai,
    registerCopy,
  ]) {
    register(harness);
    harness.cleanupFixtures();
  }
} finally {
  if (keepTemp) {
    console.log(`Keeping temp fixture root: ${harness.tempRoot}`);
  } else {
    harness.cleanup();
  }
}

const failed = reportResults(harness.results);

if (failed > 0) {
  process.exitCode = 1;
}
