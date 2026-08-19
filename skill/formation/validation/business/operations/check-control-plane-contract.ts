#!/usr/bin/env node
import { asArray, asString, isRecord, issue, reportAndExit, type Issue } from "../../../tooling/lib/launch-state.js";
import { loadDesignState, parseDesignCliArgs } from "../../../tooling/lib/design-state.js";

const args = parseDesignCliArgs(process.argv.slice(2));
const loaded = loadDesignState(args);
const issues: Issue[] = [...loaded.issues];

const requiredPanels = new Map([
  ["design-room", "active"],
  ["agent-ops", "planned"],
  ["operator-bootstrap", "planned"],
  ["analytics", "planned"],
  ["monetization", "planned"],
  ["store-ops", "planned"],
  ["growth", "planned"],
]);

if (loaded.state && isRecord(loaded.state)) {
  const controlPlane = isRecord(loaded.state.controlPlane) ? loaded.state.controlPlane : undefined;
  if (!controlPlane) {
    issues.push(issue("error", "control_plane.missing", "studio/seed/business.json must include controlPlane.", args.statePath));
  } else {
    const panels = asArray(controlPlane.panels).filter(isRecord);
    const panelById = new Map(panels.map((panel) => [asString(panel.id) ?? "", panel]));
    const futurePanels = new Set(
      asArray(controlPlane.futurePanels)
        .map((panel) => asString(panel))
        .filter((panel): panel is string => Boolean(panel)),
    );

    for (const [panelId, minimumStatus] of requiredPanels) {
      const panel = panelById.get(panelId);
      if (!panel) {
        issues.push(issue("error", `control_plane.${panelId}.missing`, `Control Plane must model ${panelId} as a first-class panel.`, args.statePath));
        continue;
      }

      const status = asString(panel.status);
      if (panelId === "design-room" && status !== "active") {
        issues.push(issue("error", "control_plane.design_room.not_active", "The Design Room panel must be active.", args.statePath));
      } else if (panelId !== "design-room" && status === "not_needed") {
        issues.push(
          issue(
            "error",
            `control_plane.${panelId}.not_needed`,
            `${panelId} cannot be marked not_needed in the skill template. It must be planned until implemented or deliberately blocked.`,
            args.statePath,
          ),
        );
      } else if (!status) {
        issues.push(issue("error", `control_plane.${panelId}.status_missing`, `${panelId} must include a panel status.`, args.statePath));
      }

      if (minimumStatus === "planned" && status !== "planned" && status !== "active" && status !== "blocked") {
        issues.push(issue("error", `control_plane.${panelId}.status_invalid`, `${panelId} must be planned, active, or blocked.`, args.statePath));
      }

      const stateRefs = asArray(panel.stateRefs)
        .map((entry) => asString(entry))
        .filter(Boolean);
      const renderedArtifacts = asArray(panel.renderedArtifacts)
        .map((entry) => asString(entry))
        .filter(Boolean);
      if (stateRefs.length === 0) {
        issues.push(issue("error", `control_plane.${panelId}.state_refs_missing`, `${panelId} must name the state/docs it reads.`, args.statePath));
      }
      if (renderedArtifacts.length === 0) {
        issues.push(
          issue("error", `control_plane.${panelId}.rendered_artifacts_missing`, `${panelId} must name at least one rendered panel/artifact.`, args.statePath),
        );
      }
      if (panelId === "design-room" && !stateRefs.includes("studio/seed/theme.tokens.json")) {
        issues.push(issue("error", "control_plane.design_room.tokens_missing", "Design Room must reference studio/seed/theme.tokens.json.", args.statePath));
      }
    }

    for (const panelId of requiredPanels.keys()) {
      if (futurePanels.has(panelId)) {
        issues.push(
          issue("error", `control_plane.${panelId}.future_only`, `${panelId} must be in controlPlane.panels, not only futurePanels.`, args.statePath),
        );
      }
    }

    for (const panel of panels) {
      const panelId = asString(panel.id);
      if (panelId && panelId.includes("_")) {
        issues.push(issue("error", "control_plane.panel_id.snake_case", `Use kebab-case panel ids, not ${panelId}.`, args.statePath));
      }
    }
  }
}

reportAndExit("Control Plane contract check", issues);
