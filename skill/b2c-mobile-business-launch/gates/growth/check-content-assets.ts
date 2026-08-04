#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import {
  asArray,
  asString,
  getPath,
  isRecord,
  issue,
  loadProjectState,
  missingPhraseCode,
  parseCliArgs,
  readText,
  reportAndExit,
} from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;

function firstExistingText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function existsAny(candidates: string[]): string | undefined {
  return candidates.find((candidate) => existsSync(path.join(args.root, candidate)));
}

function includes(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function hasFallbackApproval(text: string): boolean {
  return /\b(founder approval|founder-approved|approved fallback|fallback approved|blocked waiting for access|stop for founder approval|requires founder approval)\b/i.test(
    text,
  );
}

function hasLicenseStatus(text: string): boolean {
  return /\b(remotion license|license status|commercial use|company license|license eligibility|founder approval before commercial)\b/i.test(text);
}

function parseManifest(relativePath: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push(issue("error", "content_assets.manifest.invalid_json", `content asset manifest is invalid JSON: ${message}`, relativePath));
    return undefined;
  }
}

function manifestAssets(manifest: unknown): unknown[] {
  if (Array.isArray(manifest)) {
    return manifest;
  }
  if (isRecord(manifest)) {
    return asArray(manifest.assets);
  }
  return [];
}

function requireStringField(asset: Record<string, unknown>, field: string, index: number, file: string): void {
  if (!asString(asset[field])?.trim()) {
    issues.push(issue("error", `content_assets.manifest.assets.${index}.${field}.missing`, `Manifest asset ${index} must include ${field}.`, file));
  }
}

function requireArrayField(asset: Record<string, unknown>, field: string, index: number, file: string): void {
  const values = asArray(asset[field])
    .map(asString)
    .filter((item): item is string => Boolean(item?.trim()));
  if (values.length === 0) {
    issues.push(issue("error", `content_assets.manifest.assets.${index}.${field}.missing`, `Manifest asset ${index} must include non-empty ${field}.`, file));
  }
}

function maybeRequireDoneOutputs(asset: Record<string, unknown>, index: number, file: string): void {
  const status = asString(asset.status)?.toLowerCase();
  if (!status || !["done", "ready", "production", "approved"].includes(status)) {
    return;
  }
  for (const output of asArray(asset.outputs)
    .map(asString)
    .filter((item): item is string => Boolean(item?.trim()))) {
    if (/^[a-z]+:/i.test(output) || output.startsWith("#")) {
      continue;
    }
    if (!existsSync(path.join(args.root, output))) {
      issues.push(
        issue(
          "error",
          `content_assets.manifest.assets.${index}.output_missing`,
          `Manifest asset ${index} is marked ${status} but output path does not exist: ${output}.`,
          file,
        ),
      );
    }
  }
}

const contentStatus = state ? asString(getPath(state, "lanes.content_assets.status"))?.toLowerCase() : undefined;
const skip = contentStatus === "not_needed" || contentStatus === "deferred";
const markdown = firstExistingText(["CONTENT_ASSETS.md", "growth/content-assets/CONTENT_ASSETS.md"]);
const htmlPath = existsAny(["content-assets.html", "growth/content-assets/content-assets.html"]);
const manifestText = firstExistingText(["growth/content-assets/manifest.json", "manifest.json"]);

if (!skip && !markdown) {
  issues.push(
    issue(
      "error",
      "content_assets.markdown_missing",
      "CONTENT_ASSETS.md is required when rendered/generated launch content assets are in scope.",
      "CONTENT_ASSETS.md",
    ),
  );
}

if (markdown) {
  const requiredPhrases = [
    "Route Matrix",
    "Higgsfield",
    "Remotion",
    "Founder approval",
    "License status",
    "Source Inputs",
    "Composition Manifest",
    "Render Commands",
    "Claim Review",
    "Output Registry",
    "Public Use Gates",
  ];
  for (const phrase of requiredPhrases) {
    if (!includes(markdown.text, phrase)) {
      issues.push(issue("error", missingPhraseCode("content_assets", phrase), `CONTENT_ASSETS.md should include ${phrase}.`, markdown.relativePath));
    }
  }

  const impliesHiggsfieldFallback =
    /\b(higgsfield unavailable|higgsfield missing|higgsfield blocked|no higgsfield|higgsfield fallback|replace higgsfield|replacing higgsfield|remotion fallback|fallback from higgsfield)\b/i.test(
      markdown.text,
    );
  if (impliesHiggsfieldFallback && !hasFallbackApproval(markdown.text)) {
    issues.push(
      issue(
        "error",
        "content_assets.higgsfield_fallback_unapproved",
        "Higgsfield fallback language is present, but founder approval or blocked-access state is not recorded.",
        markdown.relativePath,
      ),
    );
  }

  if (/\bremotion\b/i.test(markdown.text) && !hasLicenseStatus(markdown.text)) {
    issues.push(
      issue(
        "error",
        "content_assets.remotion_license_unchecked",
        "Remotion is present, but license status or commercial-use approval is not recorded.",
        markdown.relativePath,
      ),
    );
  }

  if (/\b(TODO|TBD|unknown|placeholder)\b/i.test(markdown.text) && /\b(status:\s*done|launch-ready|complete|production-ready)\b/i.test(markdown.text)) {
    issues.push(
      issue(
        "error",
        "content_assets.placeholder_complete",
        "CONTENT_ASSETS.md cannot claim done/complete while placeholder language remains.",
        markdown.relativePath,
      ),
    );
  }
}

if (!skip && !htmlPath) {
  issues.push(
    issue("warning", "content_assets.html_missing", "content-assets.html should render the media route and output proof board.", "content-assets.html"),
  );
}

if (!skip && !manifestText) {
  issues.push(
    issue(
      "error",
      "content_assets.manifest_missing",
      "growth/content-assets/manifest.json is required to make rendered/generated asset outputs machine-readable.",
      "growth/content-assets/manifest.json",
    ),
  );
}

if (manifestText) {
  const parsed = parseManifest(manifestText.relativePath, manifestText.text);
  const assets = manifestAssets(parsed);
  if (isRecord(parsed) && "assets" in parsed && !Array.isArray(parsed.assets)) {
    issues.push(issue("error", "content_assets.manifest.assets.invalid", "manifest.assets must be an array.", manifestText.relativePath));
  }
  if (assets.length === 0 && contentStatus === "done") {
    issues.push(
      issue("error", "content_assets.manifest.assets.empty_done", "content asset lane is done but manifest contains no assets.", manifestText.relativePath),
    );
  }

  for (const [index, asset] of assets.entries()) {
    if (!isRecord(asset)) {
      issues.push(issue("error", `content_assets.manifest.assets.${index}.invalid`, `Manifest asset ${index} must be an object.`, manifestText.relativePath));
      continue;
    }

    for (const field of ["asset_id", "surface", "route", "status", "license_status"]) {
      requireStringField(asset, field, index, manifestText.relativePath);
    }
    for (const field of ["inputs", "outputs", "truth_constraints", "approvals"]) {
      requireArrayField(asset, field, index, manifestText.relativePath);
    }

    const route = asString(asset.route)?.toLowerCase();
    if (route === "remotion") {
      requireStringField(asset, "composition_id", index, manifestText.relativePath);
      requireStringField(asset, "dimensions", index, manifestText.relativePath);
      requireStringField(asset, "render_proof", index, manifestText.relativePath);
      const renderProof = asString(asset.render_proof) ?? "";
      if (!/\bremotion\b/i.test(renderProof)) {
        issues.push(
          issue(
            "error",
            `content_assets.manifest.assets.${index}.render_proof.not_remotion`,
            `Manifest asset ${index} uses Remotion but render_proof does not include a Remotion render/still command.`,
            manifestText.relativePath,
          ),
        );
      }
      if (!hasLicenseStatus(asString(asset.license_status) ?? "")) {
        issues.push(
          issue(
            "error",
            `content_assets.manifest.assets.${index}.license_status.unchecked`,
            `Manifest asset ${index} uses Remotion but license_status does not record Remotion commercial-use status.`,
            manifestText.relativePath,
          ),
        );
      }
    }

    if (route && (route.includes("higgsfield") || route.includes("marketing_studio"))) {
      const promptBrief = asString(asset.prompt_brief) ?? "";
      if (!promptBrief.trim()) {
        issues.push(
          issue(
            "error",
            `content_assets.manifest.assets.${index}.prompt_brief.missing`,
            `Manifest asset ${index} uses a Higgsfield/Marketing Studio route but records no prompt_brief carrying the design/DESIGN.md tokens used for generation. Generating without the design/DESIGN.md brief is a named failure mode.`,
            manifestText.relativePath,
          ),
        );
      } else if (!/design\.md|design system|design token|palette|typography/i.test(promptBrief)) {
        issues.push(
          issue(
            "warning",
            `content_assets.manifest.assets.${index}.prompt_brief.no_design_reference`,
            `Manifest asset ${index} prompt_brief should reference the design/DESIGN.md tokens (palette, typography, banned aesthetics) carried into the generation prompt.`,
            manifestText.relativePath,
          ),
        );
      }
    }

    maybeRequireDoneOutputs(asset, index, manifestText.relativePath);
  }
}

reportAndExit("Content assets packet check", issues);
