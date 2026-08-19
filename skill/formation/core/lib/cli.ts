import { pathToFileURL } from "node:url";

/**
 * Minimal `--flag value` / `--flag` (boolean) CLI argument parser shared by core's CLI
 * entrypoints (reducer, session runner, onboarding, approve, migrate-v1). A flag followed by
 * another `--flag` token, or by nothing, is recorded as `"true"`.
 */
export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token?.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

/**
 * True when the calling module was invoked directly as the process entrypoint (`tsx foo.ts`),
 * not imported by another module. Pass the caller's own `import.meta.url` — this cannot read it
 * itself, since that would report whether *this* module is the entrypoint instead.
 */
export function isMainModule(moduleUrl: string): boolean {
  return process.argv[1] !== undefined && moduleUrl === pathToFileURL(process.argv[1]).href;
}
