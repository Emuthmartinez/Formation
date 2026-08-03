# Driving The Work

Durable state, how much the agent decides on its own, and how work is dispatched — subagents, dynamic workflows, and engineering routing.

Sequencing and proving the launch itself is a separate domain: [`../process/README.md`](../process/README.md).

The first three rows share one trigger on purpose. State, autonomy, and dispatch are the same decision seen from three sides — reading `PROJECT_STATE.yaml` without knowing the autonomy mode produces confident work the founder never approved, and dispatching subagents without durable state produces work the next session cannot resume. Load them together at the start of multi-lane work.

Load the row whose trigger matches the work in front of you. Do not preload the set — each file is a full lane reference.

| Load when | Reference | Produces / gate |
| --- | --- | --- |
| start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit | [`project-state.md`](project-state.md) | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md` · `check:orchestration` |
| start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit | [`autonomy-modes.md`](autonomy-modes.md) | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md` · `check:orchestration` |
| start of multi-lane work; resuming a prior session; before provider/store mutations, handoff, or subagent dispatch; when rendering the cockpit | [`parallel-agent-orchestration.md`](parallel-agent-orchestration.md) | `PROJECT_STATE.yaml`, `launch-cockpit.html`, `ORCHESTRATION.md` · `check:orchestration` |
| a stage needs dozens-to-hundreds of agents, a codified quality pattern (adversarial verification, tournament, loop-until-done), or a run you want to read and rerun | [`dynamic-workflows.md`](dynamic-workflows.md) | — |
| before app implementation, backend/frontend work, generated builder prompts, parallel agents, worktrees, `ENGINEERING_PLAN.md`, `PRODUCTION_READINESS.md`, or production-readiness claims | [`compound-engineering-routing.md`](compound-engineering-routing.md) | Route non-trivial work through CE freshness, `ce-brainstorm` when product shape is unresolved, `ce-plan`, `ce-work`/`ce-worktree`, `ce-code-review`, applicable CE test skills, and CE proof/demo routes. When CE is unavailable, record the fallback in state and run the Standalone Engineering Loop (`engineering-orchestration.md` §1b) at the same evidence bar — engineering stays partial until all five stages have evidence · `check:compound-engineering` |
