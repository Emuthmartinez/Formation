#!/usr/bin/env node
import path from "node:path";
import {
  asArray,
  asString,
  collectAllFiles,
  collectFiles,
  getPath,
  issue,
  loadProjectState,
  parseCliArgs,
  readText,
  reportAndExit,
} from "../../scripts/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues = [...loaded.issues];
const state = loaded.state;
const secretsPath = readText(args.root, "SECRETS.md") ? "SECRETS.md" : "secrets/SECRETS.md";
const secretsText = readText(args.root, secretsPath);

if (!secretsText) {
  issues.push(
    issue(
      "error",
      "secrets.doc_missing",
      "SECRETS.md is required when the launch uses API keys, tokens, webhooks, store credentials, CI secrets, or local env files.",
      secretsPath,
    ),
  );
} else {
  for (const phrase of ["Doppler", "provider", "doppler run --", "CI", "production", "no raw secrets"]) {
    if (!secretsText.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(issue("warning", `secrets.${phrase.replaceAll(" ", "_").toLowerCase()}.missing`, `SECRETS.md should mention ${phrase}.`, secretsPath));
    }
  }
}

if (state) {
  const tools = getPath(state, "tools");
  if (tools && typeof tools === "object" && !Array.isArray(tools)) {
    for (const [toolName, value] of Object.entries(tools)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      const requiredSecrets = asArray((value as Record<string, unknown>).required_secrets)
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item));
      for (const secretName of requiredSecrets) {
        if (/key|token|secret|password|private/i.test(secretName) && !/^[A-Z0-9_]+$/.test(secretName)) {
          issues.push(
            issue("error", `secrets.${toolName}.name_format`, `${secretName} should be a names-only env var, not a value or prose.`, "PROJECT_STATE.yaml"),
          );
        }
      }
    }
  }
}

const requiredSecretNames = new Set<string>();
if (state) {
  const tools = getPath(state, "tools");
  if (tools && typeof tools === "object" && !Array.isArray(tools)) {
    for (const value of Object.values(tools)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      for (const secretName of asArray((value as Record<string, unknown>).required_secrets)) {
        const normalized = asString(secretName);
        if (normalized?.trim()) {
          requiredSecretNames.add(normalized.trim());
        }
      }
    }
  }
}

for (const secretName of secretsText?.match(/\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|DSN|PRIVATE_KEY|ISSUER_ID|KEY_ID)\b/g) ?? []) {
  requiredSecretNames.add(secretName);
}

const forbiddenFilePatterns = [
  /^\.env$/,
  /^\.env\..*\.local$/,
  /^\.env\.local$/,
  /^service-account.*\.json$/i,
  /^.*serviceAccount.*\.json$/,
  /^.*\.p8$/,
  /^.*\.p12$/,
  /^.*\.mobileprovision$/,
  /^.*\.pem$/,
];

for (const file of collectAllFiles(args.root, 10000)) {
  const relative = path.relative(args.root, file);
  const basename = path.basename(file);
  if (forbiddenFilePatterns.some((pattern) => pattern.test(basename))) {
    issues.push(
      issue(
        "error",
        `secrets.forbidden_file.${basename}`,
        `${relative} should not be committed or treated as a launch artifact. Route secrets through Doppler or the approved provider.`,
        relative,
      ),
    );
  }
}

const secretLike = /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN (PRIVATE|RSA|EC) PRIVATE KEY-----/;
const textFileExtensions = new Set([
  ".md",
  ".yaml",
  ".yml",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".swift",
  ".kt",
  ".dart",
  ".plist",
  ".example",
  ".txt",
  ".toml",
]);
const envReference = /\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|DSN|PRIVATE_KEY|ISSUER_ID|KEY_ID)\b/g;
for (const file of collectFiles(args.root, textFileExtensions, 5000)) {
  const relative = path.relative(args.root, file);
  if (relative.includes("node_modules") || relative.endsWith("package-lock.json")) {
    continue;
  }
  const text = readText(args.root, relative);
  if (text && secretLike.test(text)) {
    issues.push(issue("error", "secrets.raw_secret_pattern", `Potential raw secret pattern found in ${relative}.`, relative));
  }
  if (text && relative !== "PROJECT_STATE.yaml" && relative !== secretsPath) {
    const seenInFile = new Set(text.match(envReference) ?? []);
    for (const secretName of seenInFile) {
      if (!requiredSecretNames.has(secretName)) {
        issues.push(
          issue(
            "error",
            `secrets.${secretName}.unrouted`,
            `${secretName} appears in ${relative} but is not listed in PROJECT_STATE.yaml tools.required_secrets or ${secretsPath}.`,
            relative,
          ),
        );
      }
    }
  }
}

// Scan wrangler.toml / wrangler.json [vars] for committed credential-shaped values.
// Supabase anon/publishable keys are public-by-design, so this is a warning (smell), while
// true secret patterns (handled above by secretLike) remain errors.
const credentialShaped =
  /\b(sb_publishable_[A-Za-z0-9]{12,}|sb_secret_[A-Za-z0-9]{12,}|https:\/\/[a-z0-9]{16,}\.supabase\.co|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/;
for (const wranglerFile of ["wrangler.toml", "wrangler.json"]) {
  const wranglerText = readText(args.root, wranglerFile);
  if (!wranglerText) continue;
  const inVarsBlock = /\[vars\][\s\S]*/i.test(wranglerText) || /"vars"\s*:/.test(wranglerText);
  if (inVarsBlock && credentialShaped.test(wranglerText)) {
    issues.push(
      issue(
        "warning",
        "secrets.wrangler_toml_credentials",
        `${wranglerFile} appears to contain a credential-shaped value (Supabase URL/key or JWT) in committed config — route it through 'wrangler secret put' or Doppler-injected env vars and keep [vars] for non-secret config only.`,
        wranglerFile,
      ),
    );
  }
}

// Scan committed markdown for awk/grep credential extraction snippets.
// These patterns print raw credential values (from .env, .p8, or similar files)
// into a shell variable or stdout, which is unsafe in committed docs.
// Allowed in SECRETS.md itself (which is about naming/locations) — flag everywhere else.
// The command names MUST stay word-bounded. Unanchored, `sed` matches inside
// ordinary prose — "closed", "exposed", "compromised", "used", "parsed" — and
// any such line that later says "credentials" gets flagged as an extraction
// snippet. Incident write-ups and security notes say both words constantly, so
// the unanchored form failed exactly the docs this gate is meant to protect.
// The trailing \b matters too: it is what rules out "awkward" and "grepping".
const credentialExtractionPattern = /\b(?:awk|grep|sed)\b[^`\n]*(?:\.env|\.p8|\.p12|\.pem|clueless\.env|credentials)[^`\n]*/i;
const markdownExtensions = new Set([".md"]);
for (const file of collectFiles(args.root, markdownExtensions, 5000)) {
  const relative = path.relative(args.root, file);
  if (relative.includes("node_modules")) continue;
  // Allow the skill's own reference docs to describe the pattern; flag app-side committed docs.
  if (relative.startsWith("references/") || relative.startsWith("scripts/")) continue;
  const text = readText(args.root, relative);
  if (text && credentialExtractionPattern.test(text)) {
    issues.push(
      issue(
        "warning",
        "secrets.credential_extraction_in_markdown",
        `${relative} contains an awk/grep/sed extraction snippet referencing a credential file. ` +
          "Remove raw extraction commands from committed docs. Use 'doppler run --' or document the secret name only.",
        relative,
      ),
    );
  }
}

reportAndExit("Secret routing check", issues);
