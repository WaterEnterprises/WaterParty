import { build } from "bun";

const isWatch = process.argv.includes("--watch");
const isProd = !isWatch;

console.log(`Building web (${isWatch ? "watch" : isProd ? "production" : "development"})...`);

// Read ad unit IDs from environment (with test defaults)
const defineEnv = {
  "process.env.NODE_ENV": isProd ? '"production"' : '"development"',
  "process.env.ADMOB_APP_ID": JSON.stringify(Bun.env.ADMOB_APP_ID || ""),
  "process.env.ADMOB_INTERSTITIAL_ID": JSON.stringify(Bun.env.ADMOB_INTERSTITIAL_ID || "ca-app-pub-3940256099942544/1033173712"),
  "process.env.ADMOB_REWARDED_ID": JSON.stringify(Bun.env.ADMOB_REWARDED_ID || "ca-app-pub-3940256099942544/5224354917"),
};

const result = await build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist/assets",
  target: "browser",
  watch: isWatch,
  define: defineEnv,
});

if (!result.success) {
  console.error("Web build failed:", result.logs);
  process.exit(1);
}
console.log(`Web bundle built: ${result.outputs?.length || 1} file(s)`);

// Keep alive in watch mode
if (isWatch) {
  console.log("Watching for changes...");
  process.on("SIGINT", () => process.exit(0));
}
