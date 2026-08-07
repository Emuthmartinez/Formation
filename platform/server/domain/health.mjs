/**
 * Whether this instance is actually working.
 *
 * The endpoint this replaces answered `{ ok: true }` unconditionally. The store could be
 * unreadable, the launch engine uninstalled, the disk full, and it would still say ok — which
 * means an operator watching it learned nothing, and a load balancer in front of it would keep
 * sending traffic to an instance that could not serve a request. A probe that cannot report
 * failure is not a probe.
 *
 * Three rules:
 *
 * **Only the store can make this fail.** Formation cannot answer a single authenticated request
 * without reading it, so an unreadable store is the one condition that makes the instance unfit
 * for traffic. Everything else — the launch engine, a drafting provider, an import root — is a
 * capability some deployments deliberately do not have, and reporting an instance as broken
 * because it is configured the way its operator configured it teaches them to ignore the probe.
 *
 * **Absent and broken are different answers.** "No drafting provider is configured" is a fact
 * about this deployment. "A drafting provider is configured and its endpoint is not a URL" is a
 * mistake somebody should fix. The first is `not-configured`; the second is `misconfigured`.
 *
 * **It says nothing an anonymous caller should not know.** No filesystem paths, no environment
 * values, no dependency versions, no error text from inside the process — this route answers
 * before authentication, and the honest signal it owes an operator is reachable without also
 * handing a stranger a map of the host.
 */

export const HEALTH_STATES = Object.freeze(["ok", "degraded", "failing"]);

/** A dependency's state, and one sentence an operator can act on. */
function part(name, state, detail) {
  return { name, state, detail };
}

/**
 * Checks the instance. `probes` is injected so the suites can drive a full store, a broken store,
 * and every configuration combination without a filesystem or a network.
 */
export async function checkHealth({ readStore, engineAvailability, providerEndpoint, importRoot }, now) {
  const parts = [];

  let storeHealthy = false;
  try {
    const database = await readStore();
    storeHealthy = Boolean(database) && Array.isArray(database.workspaces);
    parts.push(
      storeHealthy
        ? part("store", "ok", "The durable store is readable.")
        : part("store", "failing", "The durable store answered with something that is not a Formation database."),
    );
  } catch {
    // The error text can carry a path or a filesystem detail; the operator gets the fact, and the
    // process log gets the rest.
    parts.push(part("store", "failing", "The durable store could not be read."));
  }

  const engine = engineAvailability();
  parts.push(
    engine === null
      ? part("launch-engine", "ok", "The launch engine is installed and its runtime resolves.")
      : part("launch-engine", "not-configured", engine),
  );

  parts.push(providerPart(providerEndpoint));

  parts.push(
    importRoot
      ? part("import-source", "ok", "Existing launch workspaces can be brought in.")
      : part("import-source", "not-configured", "This instance is not set up to bring in existing launch work."),
  );

  // Only the store decides fitness for traffic. A capability this deployment does not have is not
  // a fault, and calling it one is how an operator learns to stop reading the probe.
  const status = !storeHealthy ? "failing" : parts.some((entry) => entry.state === "misconfigured") ? "degraded" : "ok";

  return {
    status,
    service: "formation",
    time: now,
    parts,
  };
}

function providerPart(endpoint) {
  const configured = typeof endpoint === "string" && endpoint.trim();
  if (!configured) return part("drafting-provider", "not-configured", "No drafting service is configured; Formation drafts with its built-in templates.");
  try {
    const url = new URL(endpoint.trim());
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return part("drafting-provider", "misconfigured", "The drafting service endpoint is not HTTPS, which production requires.");
    }
    return part("drafting-provider", "ok", "A drafting service is configured.");
  } catch {
    return part("drafting-provider", "misconfigured", "The drafting service endpoint is not a valid URL.");
  }
}

/** The status code that goes with a state: only an instance that cannot serve is taken out. */
export function healthStatusCode(status) {
  return status === "failing" ? 503 : 200;
}
