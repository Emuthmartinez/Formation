import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFormationServer, defaultDistDir } from "./app.mjs";
import { createSeedDatabase } from "./seed.mjs";
import { JsonStore } from "./store.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.FORMATION_DATA_FILE
  ? path.resolve(process.env.FORMATION_DATA_FILE)
  : path.resolve(moduleDir, "../data/formation.json");
const port = Number(process.env.PORT ?? 4310);
const host = process.env.HOST ?? "127.0.0.1";

const store = new JsonStore({ filePath: dataFile, seedFactory: createSeedDatabase });
await store.initialize();

const { server } = createFormationServer({
  store,
  distDir: process.env.FORMATION_DIST_DIR ? path.resolve(process.env.FORMATION_DIST_DIR) : defaultDistDir,
  allowDemoAuth: process.env.ALLOW_DEMO_AUTH === "true" || process.env.NODE_ENV !== "production",
});

server.listen(port, host, () => {
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;
  const displayOrigin = ["http", "://", host, ":", String(resolvedPort)].join("");
  console.log(`Formation is running at ${displayOrigin}`);
  console.log(`Data: ${store.filePath}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
