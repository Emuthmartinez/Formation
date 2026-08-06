#!/usr/bin/env node
import { access, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const platformDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(platformDir, "..");
const command = process.argv[2] ?? "help";

switch (command) {
  case "dev":
    await runDevelopment();
    break;
  case "build":
    await runNodeTool("vite/bin/vite.js", ["build", "--config", "platform/vite.config.ts"]);
    break;
  case "start":
    await run(process.execPath, ["platform/server/index.mjs"], {
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "production", ALLOW_DEMO_AUTH: process.env.ALLOW_DEMO_AUTH ?? "false" },
    });
    break;
  case "test":
    await runTests();
    break;
  case "check":
    await runChecks();
    break;
  case "reset-data":
    await rm(path.resolve(platformDir, "data/formation.json"), { force: true });
    console.log("Formation local data removed. The seed workspace will be recreated on next start.");
    break;
  default:
    printHelp();
    if (command !== "help" && command !== "--help" && command !== "-h") process.exitCode = 1;
}

async function runDevelopment() {
  const server = spawn(process.execPath, ["platform/server/index.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development", PORT: process.env.PORT ?? "4310", ALLOW_DEMO_AUTH: "true" },
  });
  const web = spawn(process.execPath, [resolveNodeTool("vite/bin/vite.js"), "--config", "platform/vite.config.ts"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });

  const stop = () => {
    server.kill("SIGTERM");
    web.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const result = await Promise.race([
    exitResult(server, "Formation server"),
    exitResult(web, "Formation web app"),
  ]);
  stop();
  process.exitCode = result;
}

async function runTests() {
  const testDirectory = path.resolve(platformDir, "server/test");
  const files = (await readdir(testDirectory))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => path.relative(repoRoot, path.join(testDirectory, name)));
  await run(process.execPath, ["--test", ...files]);
}

async function runChecks() {
  const serverDirectory = path.resolve(platformDir, "server");
  const serverFiles = await collectFiles(serverDirectory, (name) => name.endsWith(".mjs") && !name.includes(`${path.sep}test${path.sep}`));
  for (const file of serverFiles) {
    await run(process.execPath, ["--check", path.relative(repoRoot, file)]);
  }
  await runNodeTool("typescript/bin/tsc", ["-p", "platform/tsconfig.json", "--pretty", "false"]);
  console.log(`Formation checks passed (${serverFiles.length} server modules plus TypeScript).`);
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, predicate));
    else if (predicate(absolute)) files.push(absolute);
  }
  return files.sort();
}

async function runNodeTool(relativePath, args) {
  await run(process.execPath, [resolveNodeTool(relativePath), ...args]);
}

function resolveNodeTool(relativePath) {
  return path.resolve(repoRoot, "node_modules", relativePath);
}

async function run(executable, args, options = {}) {
  if (executable.includes(`${path.sep}node_modules${path.sep}`)) await access(executable);
  const child = spawn(executable, args, { cwd: repoRoot, stdio: "inherit", ...options });
  const code = await exitResult(child, path.basename(executable));
  if (code !== 0) throw new Error(`${path.basename(executable)} exited with code ${code}.`);
}

function exitResult(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        console.error(`${label} stopped by ${signal}.`);
        resolve(1);
      } else {
        resolve(code ?? 1);
      }
    });
  });
}

function printHelp() {
  console.log(`Formation platform commands\n\n  node platform/run.mjs dev        Start API on :4310 and Vite on :4311\n  node platform/run.mjs build      Build the founder web application\n  node platform/run.mjs start      Serve the production build and API\n  node platform/run.mjs check      Type-check the web app and syntax-check the server\n  node platform/run.mjs test       Run domain, persistence, authorization, and API tests\n  node platform/run.mjs reset-data Remove the local data file and restore seed data on restart`);
}
