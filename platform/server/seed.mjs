import { readFileSync } from "node:fs";

function readSeedPart(name) {
  return JSON.parse(readFileSync(new URL(`./seed/${name}.json`, import.meta.url), "utf8"));
}

const storywellSeed = {
  ...readSeedPart("storywell-core"),
  ...readSeedPart("storywell-work"),
};

export function createSeedDatabase() {
  return structuredClone(storywellSeed);
}
