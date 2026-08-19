# Major decisions and tradeoffs

## Decision 1: Preserve the graph runtime, replace the founder interaction model

**Decision:** Keep `core/`, `catalog/`, domain knowledge, verification, and strong artifact contracts. Build a separate founder platform above them.

**Why:** The repository's execution and verification capabilities are differentiating. Rewriting them as ordinary request handlers would discard years of domain logic. The product failure was not the graph. It was making founders interact with graph outputs and filesystem projections.

**Tradeoff:** The repository temporarily contains two presentation modes: the new product and internal static skill projections. The migration document defines which one is authoritative for founders.

## Decision 2: Make `platform/` a bounded product context

**Decision:** Place the founder application at `platform/` instead of extending the maintainer Design Room.

**Why:** The Design Room reads static seed state and is intentionally a maintainer tool. Expanding it would preserve the wrong ownership boundary and mix product behavior with skill visual review.

**Tradeoff:** Some shared visual tokens are not reused directly. The new product documents its own design system and can later publish compatible tokens back to the skill.

## Decision 3: Use a stable, opinionated information architecture

**Decision:** Use Today, Business, Workstreams, Decisions, Deliverables, and Launch as primary navigation.

**Why:** These map to recurring founder jobs. They are easier to learn than generated pages, graph phases, or a directory tree.

**Tradeoff:** Not every skill artifact receives a dedicated page. Artifacts are consolidated into workstreams and the deliverable library.

## Decision 4: Treat company context as product data

**Decision:** Introduce explicit workspace, company, claim, decision, task, artifact, job, membership, and activity records.

**Why:** Files and conversations are not sufficient for tenancy, editing, contradiction detection, collaboration, or consistent generation.

**Tradeoff:** Skill state and product state require an adapter and reconciliation policy. Directly sharing one schema would couple founder experience to execution internals.

## Decision 5: Keep facts, assumptions, recommendations, and questions separate

**Decision:** Make claim kind a required field and expose it to founders.

**Why:** The largest trust failure in AI strategy products is presenting assumptions and model suggestions as facts. This classification also makes contradictions and evidence gaps inspectable.

**Tradeoff:** Founders must occasionally classify or correct a statement. That small amount of friction is intentional.

## Decision 6: Generate structured drafts through durable jobs

**Decision:** Generation produces a versioned artifact with explicit sections and confidence through a queued job.

**Why:** Long-form synchronous prose is difficult to edit, reuse, retry, or trace. Durable jobs survive navigation and provide a clean future integration point for the launch graph.

**Tradeoff:** The first implementation uses a single in-process worker. Horizontal workers require a database-backed claim or queue.

## Decision 7: Reuse React and Vite, avoid a framework migration for its own sake

**Decision:** Use the existing React 19 and Vite 8 toolchain.

**Why:** The product does not require server-rendered public pages, and the repository already carries the dependencies. A framework switch would add migration cost without improving the core founder workflow.

**Tradeoff:** Routing is intentionally lightweight. If the application gains complex nested routes, data preloading, or public marketing pages, a router or full-stack framework can be introduced behind stable page boundaries.

## Decision 8: Serve web and API from one origin

**Decision:** The production Node process serves both the API and built web application.

**Why:** Same-origin deployment simplifies session cookies, CSRF protection, configuration, and local development.

**Tradeoff:** Independent frontend scaling is deferred. It is not a meaningful constraint for the current product stage.

## Decision 9: Ship an atomic local store, document the multi-instance boundary

**Decision:** Implement a dependency-free atomic persistence adapter that supports one application process and persistent storage.

**Why:** It makes the entire platform runnable from the existing lockfile without forcing an external service or half-configured database into the repository. It also creates a tested store contract.

**Tradeoff:** It is not the final storage choice for a horizontally scaled SaaS product. Managed identity and PostgreSQL remain the highest-impact production gaps.

## Decision 10: Make readiness opinionated and fail against blockers

**Decision:** Calculate readiness from weighted workstream progress, then subtract penalties for blocked work, critical tasks, and unresolved decisions.

**Why:** A simple average rewards busywork and polished documents. The founder needs a conservative signal that reflects whether the company can defend its launch plan.

**Tradeoff:** The weights encode product opinion and will need calibration against real launch outcomes.

## Decision 11: Prefer editorial hierarchy over generic AI-SaaS UI

**Decision:** Use restrained typography, rows, sections, and strong next-action blocks. Avoid gradients, chat bubbles, a card for every datum, decorative metrics, and badge-heavy layouts.

**Why:** Founder work is dense and consequential. The interface should read like a well-edited operating document with direct controls, not a novelty AI dashboard.

**Tradeoff:** The design is intentionally less configurable. Consistency and credibility are prioritized over theme variety.

## Decision 12: Demote rather than immediately delete internal static renderers

**Decision:** Keep the cockpit, autonomy console, artifact pages, and Design Room as skill-internal compatibility and maintainer surfaces.

**Why:** Current validators, migration paths, and skill workflows still depend on them. Deleting them in the same change would create a half-migrated runtime and break existing launches.

**Tradeoff:** The repository still contains old presentation code. Its status is now explicit, and it should be removed only after skill consumers migrate to platform APIs or export adapters.
