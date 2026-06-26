#!/usr/bin/env bun
/**
 * generate-dist-package.js
 *
 * Reads root package.json and generates a minimal dist/package.json
 * containing only production dependencies with exact locked versions.
 *
 * This ensures reproducible builds when deploying just the dist/ folder,
 * since the server bundle uses --packages=external and resolves
 * node_modules at runtime via Bun's directory walk-up.
 *
 * Usage: bun run scripts/generate-dist-package.js
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");

// Read root package.json
const rootPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));

// We produce a minimal package.json that includes:
//   - name, version, type (for .cjs support)
//   - production dependencies from root (exact versions)
//   - a "start" script alias so `bun run start` works in dist/
const distPkg = {
  name: `${rootPkg.name}-server`,
  version: rootPkg.version,
  private: true,
  type: rootPkg.type || "module",
  main: "server.cjs",
  scripts: {
    start: "bun run server.cjs",
  },
  dependencies: {},
};

// Only include production dependencies (not devDependencies)
if (rootPkg.dependencies) {
  for (const [name, version] of Object.entries(rootPkg.dependencies)) {
    distPkg.dependencies[name] = version;
  }
}

writeFileSync(resolve(DIST, "package.json"), JSON.stringify(distPkg, null, 2) + "\n");
console.log(`✅ Generated dist/package.json with ${Object.keys(distPkg.dependencies).length} production dependencies`);
