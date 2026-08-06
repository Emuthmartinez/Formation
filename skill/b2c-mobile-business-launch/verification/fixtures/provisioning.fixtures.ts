import { chmodSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { assert, skillRoot, type Harness } from "./_harness.js";
import { resolveTsxBin } from "../../tooling/lib/tsx-bin.js";
import { internalVocabularyBlocklist } from "../../core/session/digest.js";
import { DELIBERATELY_UNDECLARED_PROVIDER_IDS, PROVISIONING_MANIFEST, provisioningProviderIds } from "../../core/provisioning/requirements.js";
import {
  lookupDopplerSecretNames,
  lookupEnvFileKeys,
  requirementKey,
  resolveManifest,
  resolveRequirement,
  type ResolveSources,
} from "../../core/provisioning/resolve.js";
import { renderCheck, renderPlan } from "../../core/provisioning/cli.js";

/**
 * core/provisioning fixtures: the manifest declares (requirements.ts), presence is resolved from
 * real-shaped-but-fake sources (resolve.ts), and plan/check render founder-facing text from
 * those resolutions (cli.ts) — every case here builds a `ResolveSources` by hand and calls
 * resolveManifest/renderPlan/renderCheck in-process. This suite never spawns `doppler` and never
 * lets a real DOPPLER_TOKEN or PATH-resolved doppler binary anywhere near a fixture: every
 * Doppler-shaped fact is an injected fake ReadonlySet<string> of names, never a live lookup.
 */

const tsxBin = resolveTsxBin(skillRoot);

function emptySources(overrides: Partial<ResolveSources> = {}): ResolveSources {
  return { dopplerNames: new Set(), dopplerReachable: true, envKeys: new Set(), envFileFound: false, ...overrides };
}

function scanCatalogProviderIds(): ReadonlySet<string> {
  const dir = path.join(skillRoot, "catalog/workflows");
  const ids = new Set<string>();
  for (const fileName of readdirSync(dir)) {
    if (!fileName.endsWith(".ts")) continue;
    const source = readFileSync(path.join(dir, fileName), "utf8");
    for (const arrayMatch of source.matchAll(/providers:\s*\[([^\]]*)\]/g)) {
      const inner = arrayMatch[1] ?? "";
      for (const idMatch of inner.matchAll(/"([\w.-]+)"/g)) ids.add(idMatch[1]!);
    }
  }
  return ids;
}

export function register(harness: Harness): void {
  // --- manifest completeness ------------------------------------------------------------------

  harness.check("provisioning/requirements: the catalog-provider scan itself finds providers (the completeness check below is not vacuous)", () => {
    const catalogIds = scanCatalogProviderIds();
    assert(
      catalogIds.size >= 15,
      `expected the catalog/workflows/*.ts scan to find at least 15 provider ids, found ${catalogIds.size} — the scan regex likely broke`,
    );
    assert(
      catalogIds.has("provider.doppler") && catalogIds.has("provider.revenuecat"),
      "the scan missed providers known to be in catalog/workflows/operations-trust.ts and growth-revenue.ts",
    );
  });

  harness.check("provisioning/requirements: every catalog providerId either has a manifest entry or is a named, documented exception", () => {
    const catalogIds = scanCatalogProviderIds();
    const manifestIds = new Set(provisioningProviderIds());
    const exceptions = new Set(DELIBERATELY_UNDECLARED_PROVIDER_IDS);
    const undeclared = [...catalogIds].filter((id) => !manifestIds.has(id) && !exceptions.has(id));
    assert(undeclared.length === 0, `catalog providerId(s) with no manifest entry and no documented exception: ${undeclared.join(", ")}`);
  });

  harness.check("provisioning/requirements: the documented exceptions are real catalog ids, not stale placeholders", () => {
    const catalogIds = scanCatalogProviderIds();
    const stale = DELIBERATELY_UNDECLARED_PROVIDER_IDS.filter((id) => !catalogIds.has(id));
    assert(
      stale.length === 0,
      `DELIBERATELY_UNDECLARED_PROVIDER_IDS names id(s) the catalog scan no longer finds: ${stale.join(", ")} — the exception list has drifted`,
    );
  });

  harness.check(
    "provisioning/requirements: every manifest provider has at least one requirement, and every requirement has non-empty founder-facing text",
    () => {
      for (const provider of PROVISIONING_MANIFEST) {
        assert(provider.requirements.length > 0, `${provider.providerId} declares zero requirements`);
        for (const requirement of provider.requirements) {
          assert(requirement.name.trim().length > 0, `${provider.providerId} has a requirement with an empty name`);
          assert(requirement.why.trim().length > 0, `${provider.providerId}'s "${requirement.name}" has an empty why`);
        }
      }
    },
  );

  // --- external requirements are never satisfied by presence alone ---------------------------

  harness.check("provisioning/resolve: an external requirement stays unverifiable even when every secret and config sibling is present", () => {
    const provider = PROVISIONING_MANIFEST.find((entry) => entry.providerId === "provider.revenuecat")!;
    const externalReq = provider.requirements.find((entry) => entry.kind === "external")!;
    const sources = emptySources({
      dopplerNames: new Set(["REVENUECAT_SECRET_API_KEY", "REVENUECAT_PUBLIC_IOS_KEY", "REVENUECAT_WEBHOOK_SECRET", "REVENUECAT_PROJECT_ID"]),
    });
    const resolution = resolveRequirement(provider.providerId, externalReq, sources);
    assert(
      resolution.status === "unverifiable",
      `expected "unverifiable" for an external fact backed by nothing but sibling secrets, got "${resolution.status}"`,
    );
  });

  harness.check("provisioning/resolve: an external requirement resolves satisfied ONLY via an explicit founder confirmation, never vacuously", () => {
    const provider = PROVISIONING_MANIFEST.find((entry) => entry.providerId === "provider.google-play")!;
    const externalReq = provider.requirements.find((entry) => entry.name.includes("12 testers"))!;
    const key = requirementKey(provider.providerId, externalReq.name);

    const unconfirmed = resolveRequirement(provider.providerId, externalReq, emptySources());
    assert(unconfirmed.status === "unverifiable", `expected unconfirmed external to be "unverifiable", got "${unconfirmed.status}"`);

    const confirmed = resolveRequirement(provider.providerId, externalReq, emptySources({ founderConfirmedExternal: new Set([key]) }));
    assert(
      confirmed.status === "satisfied" && confirmed.source === "founder-confirmed",
      `expected a founder-confirmed external to resolve satisfied via source "founder-confirmed", got ${JSON.stringify(confirmed)}`,
    );
  });

  harness.check("provisioning/resolve: an unrelated founder confirmation does not leak onto a different requirement", () => {
    const provider = PROVISIONING_MANIFEST.find((entry) => entry.providerId === "provider.mobai")!;
    const externalReq = provider.requirements.find((entry) => entry.kind === "external")!;
    const sources = emptySources({ founderConfirmedExternal: new Set([requirementKey("provider.google-play", "some other requirement")]) });
    const resolution = resolveRequirement(provider.providerId, externalReq, sources);
    assert(resolution.status === "unverifiable", `a confirmation for a different provider/requirement must not satisfy this one, got "${resolution.status}"`);
  });

  // --- resolver never returns or logs a value -------------------------------------------------

  harness.check("provisioning/resolve: lookupDopplerSecretNames returns parsed names but never echoes raw stdout into its own detail text", () => {
    const success = lookupDopplerSecretNames({
      workspaceDir: harness.tempRoot,
      spawn: () => ({ status: 0, stdout: '["RESEND_API_KEY","STRIPE_SECRET_KEY"]', stderr: "" }),
    });
    assert(success.reachable, "expected reachable on exit 0");
    assert(success.names.has("RESEND_API_KEY") && success.names.has("STRIPE_SECRET_KEY"), `expected both parsed names, got ${[...success.names].join(",")}`);
    assert(!success.detail.includes("RESEND_API_KEY"), `detail must summarize count, not echo raw stdout: "${success.detail}"`);

    const failure = lookupDopplerSecretNames({
      workspaceDir: harness.tempRoot,
      spawn: () => ({ status: 1, stdout: "", stderr: "error: You are not logged in. Run 'doppler login'." }),
    });
    assert(!failure.reachable, "expected unreachable on a nonzero exit");
    assert(failure.names.size === 0, "a failed lookup must never claim any secret name is present");
  });

  harness.check("provisioning/resolve: no returned RequirementResolution ever carries anything beyond the typed status/reason/source shape", () => {
    const sources = emptySources({ dopplerNames: new Set(["DOPPLER_TOKEN", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET"]) });
    const resolutions = resolveManifest(sources);
    const allowedKeys = new Set(["providerId", "kind", "name", "status", "reason", "source"]);
    for (const provider of resolutions) {
      for (const requirement of provider.requirements) {
        const keys = Object.keys(requirement);
        const unexpected = keys.filter((key) => !allowedKeys.has(key));
        assert(unexpected.length === 0, `RequirementResolution for ${requirement.name} carries unexpected field(s): ${unexpected.join(", ")}`);
      }
    }
  });

  // --- .env presence parsing: keys only, never values, never sourced -------------------------

  harness.check("provisioning/resolve: .env presence parsing detects keys without sourcing the file or returning any value", () => {
    const dir = harness.makeTempDir("provisioning-env-parse");
    const envPath = path.join(dir, ".env");
    const secretValue = "sk_live_should_never_appear_anywhere_in_output_9f3d";
    writeFileSync(
      envPath,
      [
        "# a comment line, must be skipped",
        "",
        `RESEND_API_KEY=${secretValue}`,
        "export STRIPE_SECRET_KEY=another-secret-value-2b7c",
        "THIS LINE HAS NO EQUALS AND MUST BE SKIPPED",
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_abc123",
      ].join("\n"),
      "utf8",
    );
    const result = lookupEnvFileKeys(envPath);
    assert(result.found, "expected the .env file to be found");
    assert(result.keys.size === 3, `expected exactly 3 detected keys (malformed line skipped), got ${result.keys.size}: ${[...result.keys].join(",")}`);
    for (const expected of ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
      assert(result.keys.has(expected), `expected key "${expected}" to be detected`);
    }
    const serialized = JSON.stringify([...result.keys]);
    assert(
      !serialized.includes(secretValue) && !serialized.includes("another-secret-value-2b7c") && !serialized.includes("pk_test_abc123"),
      "the returned key set must never contain a value read from the file",
    );
  });

  harness.check("provisioning/resolve: .env presence parsing reports not-found for a missing file, without throwing", () => {
    const result = lookupEnvFileKeys(path.join(harness.tempRoot, "does-not-exist.env"));
    assert(
      result.found === false && result.keys.size === 0,
      `expected {found:false, keys:empty}, got ${JSON.stringify({ found: result.found, size: result.keys.size })}`,
    );
  });

  // --- plan output is founder-vocabulary only (reuses the digest blocklist convention) -------

  harness.check("provisioning/cli: plan output never leaks internal vocabulary (reuses digest.ts's blocklist)", () => {
    assert(internalVocabularyBlocklist.length > 0, "the blocklist must not be empty");
    const resolutions = resolveManifest(emptySources());
    const plan = renderPlan(resolutions);
    assert(plan.includes("PROVISIONING CHECKLIST"), "expected the plan to render its own header");
    const leaked = internalVocabularyBlocklist.filter((term) => plan.includes(term));
    assert(leaked.length === 0, `plan output leaked internal vocabulary: ${leaked.join(", ")}`);
  });

  harness.check("provisioning/cli: the blocklist scan on plan output is not vacuous (it actually catches a leak)", () => {
    const leaking = `${renderPlan(resolveManifest(emptySources()))}\nSee run.workflow.eng-change in domain.operations — schemaVersion 1.0.0, actionClass mutate.`;
    const leaked = internalVocabularyBlocklist.filter((term) => leaking.includes(term));
    assert(
      leaked.length > 0,
      "the blocklist scan failed to catch an obviously internal-vocabulary string appended to real plan output — the check would pass vacuously",
    );
  });

  // --- check exits non-zero on a missing required item ----------------------------------------

  harness.check("provisioning/cli: check reports zero missing when every in-scope requirement resolves satisfied or unverifiable", () => {
    const sources = emptySources({ dopplerNames: new Set(["DOPPLER_TOKEN"]), provisioningConfig: { dopplerProject: "acme", dopplerConfig: "production" } });
    const resolutions = resolveManifest(sources);
    const { missingCount } = renderCheck(resolutions, new Set(["provider.doppler"]));
    assert(missingCount === 0, `expected zero missing once DOPPLER_TOKEN + project/config are set, got ${missingCount}`);
  });

  harness.check("provisioning/cli: check reports a missing count > 0, and names the missing item, when an in-scope secret is absent", () => {
    const resolutions = resolveManifest(emptySources());
    const { output, missingCount } = renderCheck(resolutions, new Set(["provider.doppler"]));
    assert(missingCount > 0, "expected at least one missing requirement for provider.doppler with nothing configured");
    assert(output.includes("DOPPLER_TOKEN"), `expected the missing DOPPLER_TOKEN requirement to be named in check output:\n${output}`);
  });

  harness.check("provisioning/cli: check ignores requirements for providers outside the granted scope", () => {
    const resolutions = resolveManifest(emptySources());
    const { missingCount } = renderCheck(resolutions, new Set()); // nothing granted
    assert(missingCount === 0, `expected zero missing when the in-scope set is empty, got ${missingCount} — check must not block on ungranted providers`);
  });

  harness.check(
    "provisioning/cli: main() exits non-zero end-to-end when a required item is missing (spawned; a PATH-shadowing stub guarantees no real `doppler` binary is ever invoked)",
    () => {
      // PATH-shadow rather than rely on doppler being absent from this machine: put a stub
      // executable named "doppler" first on PATH that always exits 1 with no output, so the real
      // subprocess's own PATH lookup resolves to the stub regardless of what else is installed.
      // The stub never touches the network and never prints anything doppler-shaped.
      const stubDir = harness.makeTempDir("provisioning-doppler-stub-bin");
      const stubPath = path.join(stubDir, "doppler");
      writeFileSync(stubPath, "#!/bin/sh\nexit 1\n", "utf8");
      chmodSync(stubPath, 0o755);
      const env = { ...process.env, PATH: `${stubDir}${path.delimiter}${process.env.PATH ?? ""}` };

      const workspace = harness.makeTempDir("provisioning-check-cli-workspace");
      const result = spawnSync(tsxBin, [path.join(skillRoot, "core/provisioning/cli.ts"), "check", "--workspace", workspace], {
        cwd: skillRoot,
        encoding: "utf8",
        timeout: 30_000,
        env,
      });
      assert(result.status === 1, `expected exit 1 on an unprovisioned workspace, got ${result.status}\n${result.stdout}\n${result.stderr}`);
      assert((result.stdout ?? "").includes("still needed"), `expected human-readable missing-item output, got:\n${result.stdout}`);
    },
  );

  // --- digest push with no configured from-address never attempts a network call -------------

  harness.check("provisioning: a digest push with no configured from-address never attempts a network call, regardless of key presence", () => {
    const digestModuleUrl = pathToFileURL(path.join(skillRoot, "core/session/digest.ts")).href;
    const driverPath = path.join(harness.makeTempDir("provisioning-push-driver"), "drive-no-from.mts");
    const driverSource = `
import { pushDigest, renderDigest } from ${JSON.stringify(digestModuleUrl)};
const rendered = renderDigest({ sessionId: "s1", businessSlug: "app", startedAt: "2026-08-05T00:00:00.000Z", endedAt: "2026-08-05T00:05:00.000Z", outcome: "completed", advanced: [], parked: [], spend: [], anomalies: [] });
let networkCalled = false;
const transport = { send: async () => { networkCalled = true; return { ok: true, id: "should-never-run" }; } };
async function main() {
  const result = await pushDigest(rendered, "founder@example.com", { env: { RESEND_API_KEY: "fixture-fake-key" }, transport });
  if (networkCalled) throw new Error("transport.send was invoked despite no from-address being configured");
  if (result.attempted !== false) throw new Error("expected attempted:false, got " + JSON.stringify(result));
  if (!result.skippedReason || !result.skippedReason.toLowerCase().includes("from-address")) throw new Error("expected a from-address-specific skip reason, got " + JSON.stringify(result));
  console.log("NO_FROM_DRIVER_OK");
}
main().catch((error) => { console.error(String(error)); process.exit(1); });
`;
    writeFileSync(driverPath, driverSource, "utf8");
    const result = spawnSync(tsxBin, [driverPath], { cwd: skillRoot, encoding: "utf8" });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert(result.status === 0 && output.includes("NO_FROM_DRIVER_OK"), `no-from driver failed (exit ${result.status}):\n${output}`);
  });
}
