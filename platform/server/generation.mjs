import { createArtifactVersion, createGeneratedArtifact, createId, generationClaims } from "./domain.mjs";

/**
 * How many drafts one company may request per hour.
 *
 * Drafting costs money, and once invited members can request it, the cost of a mistake — or of
 * someone who should not have been invited — is whatever the loop can run before anyone notices.
 * A queue-depth cap would not bound that: the worker drains continuously, so a caller could
 * enqueue, wait, and enqueue again forever. A rolling window bounds the spend itself, and bounds
 * the queue as a side effect.
 */
const HOURLY_JOB_LIMIT = 30;
const HOUR_MS = 60 * 60 * 1_000;

export class GenerationWorker {
  #store;
  #running = false;
  #timer;

  constructor(store) {
    this.#store = store;
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => void this.kick(), 1_500);
    this.#timer.unref?.();
    void this.#recoverInterruptedJobs().then(() => this.kick());
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async #recoverInterruptedJobs() {
    await this.#store.transaction((database) => {
      const now = new Date().toISOString();
      for (const job of database.jobs) {
        if (job.status !== "processing") continue;
        job.status = "queued";
        job.error = "Recovered after an interrupted generation worker.";
        job.updatedAt = now;
      }
    });
  }

  async enqueue({ workspaceId, workstreamId, artifactType, instruction, requestedBy }) {
    const job = await this.#store.transaction((database) => {
      const workspace = database.workspaces.find((entry) => entry.id === workspaceId);
      const workstream = workspace?.workstreams.find((entry) => entry.id === workstreamId);
      if (!workspace || !workstream) throw new GenerationError(404, "Workstream not found.");

      // The bound is per company, so one company's spending never limits another's.
      const windowStart = Date.now() - HOUR_MS;
      const recent = database.jobs.filter(
        (entry) => entry.workspaceId === workspaceId && new Date(entry.createdAt).getTime() >= windowStart,
      ).length;
      if (recent >= HOURLY_JOB_LIMIT) {
        throw new GenerationError(
          429,
          `This company has requested ${recent} drafts in the past hour, which is as many as Formation will draft at once. Review what is already here, then ask again later.`,
        );
      }

      const now = new Date().toISOString();
      const next = {
        id: createId("job"),
        workspaceId,
        workstreamId,
        artifactType: artifactType || null,
        instruction: String(instruction ?? "").trim(),
        requestedBy,
        status: "queued",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        artifactId: null,
        error: null,
      };
      database.jobs.push(next);
      database.activity.push({
        id: createId("act"),
        workspaceId,
        type: "generation-queued",
        title: `Draft requested for ${workstream.title}`,
        detail: next.instruction || "Generate the next useful structured deliverable.",
        actor: requestedBy,
        createdAt: now,
      });
      return next;
    });

    queueMicrotask(() => void this.kick());
    return job;
  }

  async kick() {
    if (this.#running) return;
    this.#running = true;
    try {
      while (await this.#processNext()) {
        // Drain the durable queue in order. A single worker avoids duplicate artifacts
        // in the local adapter; production deployments should claim jobs in Postgres.
      }
    } catch (error) {
      console.error("Formation generation worker stopped before draining the queue:", error instanceof Error ? error.message : String(error));
    } finally {
      this.#running = false;
    }
  }

  async #processNext() {
    const claimed = await this.#store.transaction((database) => {
      const job = database.jobs.find((entry) => entry.status === "queued");
      if (!job) return null;
      job.status = "processing";
      job.error = null;
      job.updatedAt = new Date().toISOString();
      return job;
    });
    if (!claimed) return false;

    try {
      const database = await this.#store.read();
      const workspace = database.workspaces.find((entry) => entry.id === claimed.workspaceId);
      const workstream = workspace?.workstreams.find((entry) => entry.id === claimed.workstreamId);
      if (!workspace || !workstream) throw new Error("The workspace changed before generation started.");

      const context = buildGenerationContext(database, workspace, workstream, claimed);
      const artifact = await generateArtifact(context);
      artifact.sourceClaimIds = context.claims.map((entry) => entry.id);
      artifact.linkedDecisionIds = context.decisions.map((entry) => entry.id);
      const timestamp = new Date().toISOString();
      artifact.createdAt = timestamp;
      artifact.updatedAt = timestamp;

      await this.#store.transaction((nextDatabase) => {
        const liveJob = nextDatabase.jobs.find((entry) => entry.id === claimed.id);
        const liveWorkspace = nextDatabase.workspaces.find((entry) => entry.id === claimed.workspaceId);
        const liveWorkstream = liveWorkspace?.workstreams.find((entry) => entry.id === claimed.workstreamId);
        if (!liveJob || !liveWorkspace || !liveWorkstream) throw new Error("Generation target no longer exists.");

        nextDatabase.artifacts.push(artifact);
        nextDatabase.artifactVersions.push(createArtifactVersion(artifact, "Formation"));
        nextDatabase.claims.push(
          ...generationClaims({
            workspaceId: claimed.workspaceId,
            workstreamId: claimed.workstreamId,
            artifact,
          }),
        );
        if (!liveWorkstream.deliverableIds.includes(artifact.id)) liveWorkstream.deliverableIds.push(artifact.id);
        liveWorkstream.progress = Math.min(96, liveWorkstream.progress + 4);
        liveWorkstream.status = liveWorkstream.status === "blocked" ? "needs-attention" : liveWorkstream.status;
        liveWorkspace.updatedAt = timestamp;

        liveJob.status = "completed";
        liveJob.artifactId = artifact.id;
        liveJob.completedAt = timestamp;
        liveJob.updatedAt = timestamp;
        nextDatabase.activity.push({
          id: createId("act"),
          workspaceId: claimed.workspaceId,
          type: "artifact-generated",
          title: `${artifact.title} created`,
          detail: "A structured draft is ready for founder review and editing.",
          actor: "Formation",
          createdAt: timestamp,
        });
      });
    } catch (error) {
      await this.#store.transaction((database) => {
        const job = database.jobs.find((entry) => entry.id === claimed.id);
        if (!job) return;
        job.status = "failed";
        job.error = error instanceof Error ? error.message : String(error);
        job.updatedAt = new Date().toISOString();
      });
    }
    return true;
  }
}

async function generateArtifact(context) {
  const endpoint = process.env.FORMATION_AI_ENDPOINT?.trim();
  if (!endpoint) return createGeneratedArtifact(context);

  let providerUrl;
  try {
    providerUrl = new URL(endpoint);
  } catch {
    throw new Error("FORMATION_AI_ENDPOINT must be a valid URL.");
  }
  if (process.env.NODE_ENV === "production" && providerUrl.protocol !== "https:") {
    throw new Error("The production generation endpoint must use HTTPS.");
  }

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.FORMATION_AI_API_KEY
        ? { authorization: `Bearer ${process.env.FORMATION_AI_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      task: "Create one structured, editable founder deliverable. Separate evidence, assumptions, recommendations, and open questions.",
      context,
      responseSchema: {
        title: "string",
        summary: "string",
        confidence: "number 0-100",
        sections: [{ title: "string", body: "markdown string" }],
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);

  const source = await response.text();
  if (Buffer.byteLength(source, "utf8") > 1_000_000) {
    throw new Error("AI provider response exceeded the 1 MB safety limit.");
  }

  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    throw new Error("AI provider did not return valid JSON.");
  }
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.sections)) {
    throw new Error("AI provider did not return the required structured artifact schema.");
  }

  const fallback = createGeneratedArtifact(context);
  const sections = payload.sections
    .filter((section) => section && typeof section.title === "string" && typeof section.body === "string")
    .slice(0, 12)
    .map((section) => ({
      id: createId("sec"),
      title: boundedText(section.title, 200),
      body: boundedText(section.body, 20_000),
    }))
    .filter((section) => section.title && section.body);
  if (!sections.length) throw new Error("AI provider returned no usable artifact sections.");

  return {
    ...fallback,
    title: typeof payload.title === "string" && payload.title.trim()
      ? boundedText(payload.title, 200)
      : fallback.title,
    summary: typeof payload.summary === "string"
      ? boundedText(payload.summary, 2_000)
      : fallback.summary,
    confidence: Number.isFinite(payload.confidence)
      ? Math.max(0, Math.min(100, Math.round(payload.confidence)))
      : fallback.confidence,
    sections,
  };
}

function boundedText(value, maximumLength) {
  return String(value ?? "").trim().slice(0, maximumLength);
}

function buildGenerationContext(database, workspace, workstream, job) {
  return {
    workspace,
    workstream,
    artifactType: job.artifactType,
    instruction: job.instruction,
    decisions: database.decisions.filter(
      (entry) =>
        entry.workspaceId === workspace.id &&
        [workstream.id, "strategy"].includes(entry.workstreamId) &&
        entry.status !== "superseded",
    ),
    claims: database.claims.filter(
      (entry) =>
        entry.workspaceId === workspace.id &&
        [workstream.id, "strategy"].includes(entry.workstreamId) &&
        !["rejected", "superseded"].includes(entry.status),
    ),
    artifacts: database.artifacts
      .filter((entry) => entry.workspaceId === workspace.id && entry.status !== "superseded")
      .map(({ id, title, summary, status, version, workstreamId }) => ({ id, title, summary, status, version, workstreamId })),
  };
}

export class GenerationError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GenerationError";
    this.status = status;
  }
}
