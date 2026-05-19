/**
 * tsx → esbuild needs the platform-specific @esbuild/* package.
 * If optional deps were skipped (e.g. omit=optional), install.js fetches the right binary.
 */
const { existsSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const installJs = join(__dirname, "..", "node_modules", "esbuild", "install.js");
if (!existsSync(installJs)) {
  process.exit(0);
}
const result = spawnSync(process.execPath, [installJs], {
  cwd: join(__dirname, "..", "node_modules", "esbuild"),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
