import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createFormationServer } from "../app.mjs";
import { CAPABILITIES, ROLES, capabilitiesForRole, hasCapability, resolveAccess } from "../domain/capabilities.mjs";
import { createSeedDatabase } from "../seed.mjs";
import { JsonStore } from "../store.mjs";

const serverDir = path.dirname(fileURLToPath(new URL("../", import.meta.url)));
const routesDir = path.join(serverDir, "server/routes");

/**
 * Every workspace-scoped surface, and the capability it is supposed to sit behind.
 *
 * This is not documentation. Two things make it load-bearing: the structural half of this file
 * fails when a route exists in source that is not listed here, and the behavioural half calls each
 * listed surface as a real member of every role and checks the server actually answered the way
 * the capability says it should. A new mutation route cannot ship without appearing here, and
 * appearing here without the check wired up fails on the next line.
 */
const WORKSPACE_SURFACES = [
  { method: "GET", path: "/api/workspaces/:workspaceId", capability: "workspace-read" },
  { method: "PATCH", path: "/api/workspaces/:workspaceId", capability: "company-write", body: { stage: "validation" } },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/company", capability: "company-write", body: { pricing: "Tested." } },
  {
    method: "PATCH",
    path: "/api/workspaces/:workspaceId/workstreams/:workstreamId",
    capability: "work-write",
    body: { summary: "Reworded." },
  },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/claims",
    capability: "evidence-write",
    body: { workstreamId: "strategy", kind: "question", statement: "Who is the first buyer?" },
  },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/claims/:claimId", capability: "evidence-write", body: { confidence: 61 } },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/decisions",
    capability: "decision-write",
    body: { workstreamId: "strategy", title: "Ship weekly", decision: "Weekly releases.", rationale: "Feedback speed." },
  },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/decisions/:decisionId", capability: "decision-write", body: { status: "revisit" } },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/tasks",
    capability: "work-write",
    body: { workstreamId: "strategy", title: "Call five customers" },
  },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/tasks/:taskId", capability: "work-write", body: { status: "doing" } },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/artifacts/:artifactId", capability: "work-write", body: { confidence: 55 } },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/generate",
    capability: "generation-request",
    body: { workstreamId: "strategy" },
  },
  { method: "GET", path: "/api/workspaces/:workspaceId/jobs/:jobId", capability: "workspace-read" },
  { method: "GET", path: "/api/workspaces/:workspaceId/executions", capability: "workspace-read" },
  { method: "GET", path: "/api/workspaces/:workspaceId/executions/:executionId", capability: "workspace-read" },
  { method: "POST", path: "/api/workspaces/:workspaceId/executions", capability: "launch-engine-advance", body: {} },
  // Which launch workspaces this server holds is not company data — it is a fact about the host.
  // It sits behind the same owner-level capability as the import itself rather than behind read.
  { method: "GET", path: "/api/workspaces/:workspaceId/import-sources", capability: "launch-import" },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/imports/preview",
    capability: "launch-import",
    body: { sourceId: "absent-source" },
  },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/imports",
    capability: "launch-import",
    body: { sourceId: "absent-source" },
  },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/comments",
    capability: "comment-write",
    body: { target: { kind: "workstream", id: "strategy" }, body: "Is this still the wedge?" },
  },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/comments/:commentId", capability: "comment-write", body: { resolved: true } },
  { method: "DELETE", path: "/api/workspaces/:workspaceId/comments/:commentId", capability: "comment-write" },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/reviews",
    capability: "comment-write",
    body: { target: { kind: "workstream", id: "strategy" }, assigneeId: "usr_absent" },
  },
  // Answering is probed against an absent request: a held capability must reach past the role check
  // (to a 404) rather than actually answering on someone else's behalf while the probe walks by.
  { method: "POST", path: "/api/workspaces/:workspaceId/reviews/:reviewId", capability: "comment-write", body: { answer: "approved" } },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/economics/scenarios",
    capability: "company-write",
    body: { name: "Probe scenario" },
  },
  { method: "PATCH", path: "/api/workspaces/:workspaceId/economics/scenarios/:scenarioId", capability: "company-write", body: { name: "Renamed" } },
  { method: "DELETE", path: "/api/workspaces/:workspaceId/economics/scenarios/:scenarioId", capability: "company-write" },
  { method: "GET", path: "/api/workspaces/:workspaceId/approvals", capability: "workspace-read" },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/approvals/:decisionId",
    capability: "approval-decide",
    body: { answer: "approve" },
  },
  { method: "GET", path: "/api/workspaces/:workspaceId/members", capability: "workspace-read" },
  {
    method: "PATCH",
    path: "/api/workspaces/:workspaceId/members/:membershipId",
    capability: "member-manage",
    body: { role: "viewer" },
  },
  // Probed against a membership that is not the caller's own, which is the administrative act.
  // Leaving a company is the caller's own to do at any role and is covered in members.test.mjs.
  { method: "DELETE", path: "/api/workspaces/:workspaceId/members/:membershipId", capability: "member-manage" },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/invitations",
    capability: "member-manage",
    body: { email: "probe@example.com", role: "viewer" },
  },
  { method: "DELETE", path: "/api/workspaces/:workspaceId/invitations/:invitationId", capability: "member-manage" },
  { method: "GET", path: "/api/workspaces/:workspaceId/shares", capability: "workspace-read" },
  {
    method: "POST",
    path: "/api/workspaces/:workspaceId/shares",
    capability: "share-manage",
    body: { scope: "company" },
  },
  { method: "DELETE", path: "/api/workspaces/:workspaceId/shares/:shareId", capability: "share-manage" },
];

/**
 * Surfaces that are deliberately outside the role ladder. Listing them here is what makes their
 * absence from the matrix a decision rather than an oversight; the structural check below treats
 * anything not in either list as an unreviewed new route.
 */
const UNSCOPED_ROUTES = new Set([
  "GET /api/health",
  "GET /api/config",
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/demo",
  "POST /api/auth/logout",
  "GET /api/session",
  "GET /api/workspaces",
  "POST /api/workspaces",
  // Joining a company happens before there is a membership to hold a capability. The invitation
  // token is the authorization, and it is checked against the signed-in account's own email.
  "POST /api/invitations/preview",
  "POST /api/invitations/accept",
  // The account's own security surface. Scoped to the signed-in user by construction — no
  // identifier in any of these requests can point at somebody else's account.
  "GET /api/account/sessions",
  "DELETE /api/account/sessions",
  "DELETE /api/account/sessions/:sessionId",
  "POST /api/account/password",
  // Read by someone with no account at all. The link is the authorization, and what it reaches is
  // a projection built field by field in domain/sharing.mjs rather than a filtered record.
  "GET /api/shared/:token",
]);

test("the capability ladder denies by default and refuses unknown capability ids", () => {
  assert.deepEqual(ROLES, ["viewer", "reviewer", "editor", "owner"]);

  // A role the ladder does not recognise holds nothing. A hand-edited store file, a future bug, or
  // a membership written by an older version locks its holder out rather than letting them through.
  for (const capability of Object.keys(CAPABILITIES)) {
    assert.equal(hasCapability("superuser", capability), false, `unknown role held ${capability}`);
    assert.equal(hasCapability(undefined, capability), false, `undefined role held ${capability}`);
    assert.equal(hasCapability("", capability), false, `empty role held ${capability}`);
  }

  // A typo in a capability id must not read as "denied" — a route that silently denies everyone is
  // as broken as one that allows everyone, and much harder to notice.
  assert.throws(() => hasCapability("owner", "worskpace-read"), /Unknown workspace capability/);
  assert.throws(() => resolveAccess({ memberships: [], workspaces: [] }, "w", "u", "nope"), /Unknown workspace capability/);

  // The ladder is ordinal: every role holds everything the roles below it hold.
  for (let index = 1; index < ROLES.length; index += 1) {
    const lower = capabilitiesForRole(ROLES[index - 1]);
    const higher = capabilitiesForRole(ROLES[index]);
    for (const capability of lower) {
      assert.ok(higher.includes(capability), `${ROLES[index]} lost ${capability} held by ${ROLES[index - 1]}`);
    }
    assert.ok(higher.length > lower.length, `${ROLES[index]} holds no more than ${ROLES[index - 1]}`);
  }

  assert.deepEqual(capabilitiesForRole("owner").sort(), Object.keys(CAPABILITIES).sort());
  assert.deepEqual(capabilitiesForRole("viewer"), ["workspace-read"]);
});

test("every route in source is covered by a capability or an explicit exemption", async () => {
  const files = (await readdir(routesDir)).filter((name) => name.endsWith(".mjs") && name !== "shared.mjs");
  const declaredPaths = new Set(
    WORKSPACE_SURFACES.map((surface) => surface.path.replace(/:[A-Za-z]+/g, ":param")),
  );
  for (const route of UNSCOPED_ROUTES) declaredPaths.add(route.split(" ")[1].replace(/:[A-Za-z]+/g, ":param"));

  const found = new Set();
  let mutatingBranches = 0;
  for (const name of files) {
    const source = await readFile(path.join(routesDir, name), "utf8");

    // Literal routes: pathname === "/api/…"
    for (const match of source.matchAll(/pathname === "([^"]+)"/g)) found.add(match[1]);
    // Pattern routes: /^\/api\/workspaces\/([^/]+)\/claims$/ → /api/workspaces/:param/claims
    // The capture must be able to cross the ")" that closes the route's own ([^/]+) group. An
    // earlier version used [^)]*? here, which could never reach the closing $/) on any real
    // route — the assertion below passed on every tree because it was reading an empty set.
    for (const match of source.matchAll(/pathname\.match\(\/\^(.*?)\$\/\)/g)) {
      found.add(match[1].replace(/\\\//g, "/").replace(/\(\[\^\/\]\+\)/g, ":param"));
    }
    // Any handler that writes: one per mutating method branch, counted so a new method on an
    // already-known path cannot slip in behind an existing path pattern. Both forms count —
    // routes that guard a single method write it as `method !== "POST"` and throw 405.
    mutatingBranches += [...source.matchAll(/method (?:===|!==) "(?:POST|PATCH|PUT|DELETE)"/g)].length;
  }

  const undeclared = [...found].filter((route) => !declaredPaths.has(route));
  assert.deepEqual(
    undeclared,
    [],
    `New API route(s) with no declared capability: ${undeclared.join(", ")}. Add them to WORKSPACE_SURFACES with the capability that guards them, or to UNSCOPED_ROUTES with a reason.`,
  );

  // And the other direction. Without this, the cheapest way to silence the count assertion below
  // is to invent a declaration that names no real route — which would satisfy the arithmetic while
  // leaving the actual new route unguarded and never exercised by the role probe.
  const phantom = [...declaredPaths].filter((route) => !found.has(route));
  assert.deepEqual(
    phantom,
    [],
    `Declared route(s) that do not exist in routes/: ${phantom.join(", ")}. Every entry in WORKSPACE_SURFACES and UNSCOPED_ROUTES must name a route the server actually serves.`,
  );

  const declaredMutations =
    WORKSPACE_SURFACES.filter((surface) => surface.method !== "GET").length +
    [...UNSCOPED_ROUTES].filter((route) => !route.startsWith("GET ")).length;
  assert.equal(
    mutatingBranches,
    declaredMutations,
    `routes/ contains ${mutatingBranches} POST/PATCH/PUT/DELETE branches but ${declaredMutations} are declared. A new mutation must be added to WORKSPACE_SURFACES with the capability that guards it (or to UNSCOPED_ROUTES with a reason) so the role probe below exercises it.`,
  );
});

test("routes reach engine mirrors only through the checked execution worker", async () => {
  const files = (await readdir(routesDir)).filter((name) => name.endsWith(".mjs"));
  for (const name of files) {
    const source = await readFile(path.join(routesDir, name), "utf8");
    // domain/approvals.mjs, domain/results.mjs, and domain/imports.mjs mutate the claim, decision,
    // task, and deliverable record with no notion of who is asking — execution.mjs and imports.mjs
    // are the only callers, and both are handed a workspace a route has already checked.
    assert.ok(
      !/from "\.\.\/domain\/(approvals|results|imports)\.mjs"/.test(source),
      `${name} imports an unchecked engine mirror directly; go through the execution worker or the import service instead.`,
    );
  }
});

test("every execution-worker membership check names a capability", async () => {
  const source = await readFile(path.join(serverDir, "server/execution.mjs"), "utf8");
  const calls = [...source.matchAll(/require(?:Membership|MemberWorkspace)\(([^)]*)\)/g)]
    .map((match) => match[1])
    .filter((argumentList) => !argumentList.includes("database, workspaceId, userId, capabilityId"));
  assert.ok(calls.length >= 3, "expected the execution worker to still perform membership checks");
  for (const argumentList of calls) {
    assert.match(
      argumentList,
      /"[a-z-]+"/,
      `An execution-worker membership check passes no capability: requireMembership(${argumentList})`,
    );
  }
});

/* ------------------------------------------------------------------------------------------- */

async function startServerWithRoles() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "formation-caps-"));
  const store = new JsonStore({ filePath: path.join(directory, "formation.json"), seedFactory: createSeedDatabase });
  await store.initialize();

  await store.transaction((database) => {
    for (const role of ROLES) {
      if (role === "owner") continue;
      database.users.push({
        id: `usr_${role}`,
        email: `${role}@formation.local`,
        name: `Test ${role}`,
        createdAt: new Date().toISOString(),
      });
      database.memberships.push({
        id: `mem_${role}`,
        userId: `usr_${role}`,
        workspaceId: "wrk_storywell",
        role,
        createdAt: new Date().toISOString(),
      });
    }
    // A signed-in stranger with no membership at all.
    database.users.push({ id: "usr_stranger", email: "stranger@formation.local", name: "Stranger", createdAt: new Date().toISOString() });
  });

  const { server } = createFormationServer({ store, allowDemoAuth: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    store,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function signIn(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal(response.status, 200, `could not sign in as ${email}`);
  return response.headers.get("set-cookie").split(";")[0];
}

function resolvePath(template, ids) {
  return template
    .replace(":workspaceId", ids.workspaceId)
    .replace(":workstreamId", "strategy")
    .replace(":claimId", ids.claimId)
    .replace(":decisionId", ids.decisionId)
    .replace(":taskId", ids.taskId)
    .replace(":artifactId", ids.artifactId)
    .replace(":executionId", "exe_absent")
    .replace(":jobId", "job_absent")
    // Absent on purpose: an owner must reach past the capability check (to a 404) rather than
    // actually removing someone while the probe is walking the surface.
    .replace(":membershipId", "mem_absent")
    .replace(":invitationId", "inv_absent")
    .replace(":shareId", "shr_absent")
    .replace(":commentId", "cmt_absent")
    .replace(":reviewId", "rvw_absent")
    .replace(":scenarioId", "scn_absent");
}

test("each role is answered by the server exactly as its capability says", async (t) => {
  const app = await startServerWithRoles();
  t.after(app.close);

  const database = await app.store.read();
  const ids = {
    workspaceId: "wrk_storywell",
    claimId: database.claims.find((entry) => entry.workspaceId === "wrk_storywell").id,
    decisionId: database.decisions.find((entry) => entry.workspaceId === "wrk_storywell" && !entry.source).id,
    taskId: database.tasks.find((entry) => entry.workspaceId === "wrk_storywell").id,
    artifactId: database.artifacts.find((entry) => entry.workspaceId === "wrk_storywell").id,
  };

  for (const role of ROLES) {
    const email = role === "owner" ? "founder@formation.local" : `${role}@formation.local`;
    const cookie = await signIn(app.baseUrl, email);

    for (const surface of WORKSPACE_SURFACES) {
      const allowed = hasCapability(role, surface.capability);
      const response = await fetch(`${app.baseUrl}${resolvePath(surface.path, ids)}`, {
        method: surface.method,
        headers: { cookie, ...(surface.body ? { "content-type": "application/json" } : {}) },
        ...(surface.body ? { body: JSON.stringify(surface.body) } : {}),
      });

      if (allowed) {
        // Held capabilities may still fail for unrelated reasons — an absent job id, an engine
        // that is not installed in the test environment. What must never happen is a refusal
        // that says the member is not allowed.
        assert.notEqual(
          response.status,
          403,
          `${role} holds ${surface.capability} but ${surface.method} ${surface.path} answered 403`,
        );
      } else {
        assert.equal(
          response.status,
          403,
          `${role} does not hold ${surface.capability} yet ${surface.method} ${surface.path} answered ${response.status}`,
        );
        const payload = await response.json();
        assert.equal(payload.error, CAPABILITIES[surface.capability].denial);
      }
    }
  }
});

test("a signed-in stranger is told the company does not exist, not that they lack a capability", async (t) => {
  const app = await startServerWithRoles();
  t.after(app.close);
  const cookie = await signIn(app.baseUrl, "stranger@formation.local");

  for (const surface of WORKSPACE_SURFACES) {
    const response = await fetch(`${app.baseUrl}${resolvePath(surface.path, {
      workspaceId: "wrk_storywell",
      claimId: "clm_x",
      decisionId: "dec_x",
      taskId: "tsk_x",
      artifactId: "art_x",
    })}`, {
      method: surface.method,
      headers: { cookie, ...(surface.body ? { "content-type": "application/json" } : {}) },
      ...(surface.body ? { body: JSON.stringify(surface.body) } : {}),
    });
    assert.equal(response.status, 404, `${surface.method} ${surface.path} leaked existence to a stranger`);
  }
});

test("the snapshot tells the web app what this member may do", async (t) => {
  const app = await startServerWithRoles();
  t.after(app.close);

  for (const role of ROLES) {
    const email = role === "owner" ? "founder@formation.local" : `${role}@formation.local`;
    const cookie = await signIn(app.baseUrl, email);
    const response = await fetch(`${app.baseUrl}/api/workspaces/wrk_storywell`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const snapshot = await response.json();
    assert.equal(snapshot.membership.role, role);
    assert.deepEqual(snapshot.capabilities.sort(), capabilitiesForRole(role).sort());
  }
});
