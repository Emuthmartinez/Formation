import { accessLabel } from "./founder-copy.js";
import { escapeHtml } from "./html.js";

export function renderFounderGateMarkup(founderModel: Record<string, unknown>, businessOperator: Record<string, unknown>): string {
  const activeFounderGateValue = founderModel.activeFounderGate;
  const hasActiveFounderGate = isRecord(activeFounderGateValue);
  const activeFounderGate: Record<string, unknown> = hasActiveFounderGate ? activeFounderGateValue : {};
  const activePhase = isRecord(founderModel.currentPhase) ? founderModel.currentPhase : isRecord(activeFounderGate.phase) ? activeFounderGate.phase : {};
  const activeQuestion = isRecord(activeFounderGate.question) ? activeFounderGate.question : {};
  const activeOptions = asArray(activeQuestion.options).filter(isRecord);
  const activeDefinitions = asArray(activeFounderGate.definitions).filter(isRecord);
  const activeBypass = isRecord(activeFounderGate.bypassPolicy) ? activeFounderGate.bypassPolicy : {};
  const founderOptionMarkup = activeOptions
    .map(
      (option) =>
        `<article class="card"><h3>${escapeHtml(option.label)}${option.recommended === true ? " (Recommended)" : ""}</h3><p>${escapeHtml(option.description)}</p><p><strong>If you pick this:</strong> ${escapeHtml(option.consequence)}</p><p><strong>Then I will:</strong> ${escapeHtml(option.agentActionNext)}</p><p class="muted">What it means for how solid this is: ${escapeHtml(option.evidenceEffect)}</p></article>`,
    )
    .join("");
  const founderDefinitionsMarkup =
    activeDefinitions.length > 0
      ? activeDefinitions.map((entry) => `<p><strong>${escapeHtml(entry.term)}:</strong> ${escapeHtml(entry.meaning)}</p>`).join("")
      : hasActiveFounderGate
        ? '<p class="muted">No unfamiliar terms are needed for this decision.</p>'
        : '<p class="muted">No founder decision is pending, so no definitions are needed.</p>';

  // Founder-visible copy only. Machine values (status enums, phase ids, gate ids, the
  // founder_experience and agent_role settings, ledger file paths, and the name of the
  // tool used to ask the question) are deliberately not rendered here — they exist for
  // the agent and for validators, and printing them turned this card into a database
  // row. check-founder-copy.ts enforces that.
  return `<div class="grid">
    <article class="card"><h3>The decision</h3>${
      hasActiveFounderGate
        ? `<p>${escapeHtml(activeQuestion.prompt ?? businessOperator.next_founder_action ?? "Not recorded")}</p><p class="muted">Pick one below. I will wait, and I never read silence as a yes.</p>`
        : "<p>No founder decision is pending. I am carrying on with the next piece of work.</p>"
    }</article>
    <article class="card"><h3>What this unlocks</h3><p><strong>${escapeHtml(activePhase.label ?? businessOperator.current_phase_label ?? "Not recorded")}</strong></p><p>${escapeHtml(
      activePhase.outcome ?? businessOperator.current_phase_outcome ?? "Not recorded",
    )}</p>${hasActiveFounderGate ? `<p class="muted">This is a ${escapeHtml(gateClassLabel(activeFounderGate.gateClass).toLowerCase())} decision. It came up because of ${escapeHtml(gateOriginLabel(activeFounderGate.origin).toLowerCase())}.</p>` : ""}</article>
    <article class="card"><h3>Words worth knowing</h3>${founderDefinitionsMarkup}</article>
    ${founderOptionMarkup}
    ${
      hasActiveFounderGate
        ? `<article class="card"><h3>If You Are Not Ready</h3><p><strong>${escapeHtml(bypassModeLabel(activeBypass.mode))}</strong></p><p><strong>Why that is safe:</strong> ${escapeHtml(
            activeBypass.reason ?? "Not recorded",
          )}</p><p>${escapeHtml(activeBypass.fallbackAction ?? "Not recorded")}</p><p><strong>I will ask again:</strong> ${escapeHtml(
            activeBypass.revisitTrigger ?? "Not recorded",
          )}</p><p class="muted">Meanwhile: ${escapeHtml(activeFounderGate.safeWorkWhileWaiting ?? "No safe work recorded")}</p></article>`
        : ""
    }
    <article class="card"><h3>What I am doing next</h3><p>${escapeHtml(businessOperator.next_agent_action ?? "Not recorded")}</p><p><strong>Then:</strong> ${escapeHtml(
      businessOperator.next_business_operation ?? "Not recorded",
    )}</p></article>
    <article class="card"><h3>Where your accounts stand</h3><p>Setup so far: ${escapeHtml(accessLabel(businessOperator.status))}</p><p>Secure key storage: ${escapeHtml(
      accessLabel(businessOperator.doppler_status),
    )}</p><p>Social accounts: ${escapeHtml(accessLabel(businessOperator.social_access_status))}</p><p>Accounts ready to use: ${escapeHtml(
      businessOperator.access_ready_count ?? 0,
    )}</p></article>
  </div>`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function gateClassLabel(value: unknown): string {
  const labels: Record<string, string> = {
    access: "Account access",
    spend: "Money or paid credits",
    legal: "Legal approval",
    pricing: "Pricing decision",
    public_action: "Public action",
    release: "Release decision",
    destructive: "Destructive action",
    research: "Research approach",
    scope: "Working scope",
    provider_route: "Tool route",
    other: "Other founder decision",
  };
  return labels[String(value ?? "")] ?? "Founder decision";
}

function gateOriginLabel(value: unknown): string {
  const labels: Record<string, string> = {
    user_request: "Your request",
    platform_requirement: "Platform requirement",
    legal_requirement: "Legal requirement",
    skill_requirement: "Launch workflow",
    agent_proposal: "Agent recommendation",
  };
  return labels[String(value ?? "")] ?? "Current work";
}

function bypassModeLabel(value: unknown): string {
  return value === "fallback_allowed" ? "A safe fallback is available" : value === "defer_only" ? "This can be deferred, not bypassed" : "Not recorded";
}
