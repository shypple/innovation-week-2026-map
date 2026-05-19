/**
 * Side-effect module: load `server/.env` as early as possible.
 *
 * In ESM, `import` declarations are evaluated before the rest of the file.
 * Putting `import "./loadEnv.js"` first in `index.ts` guarantees `dotenv.config`
 * runs before `main()` and before route registration.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const serverSrcDir = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_PACKAGE_DIR = path.resolve(serverSrcDir, "..");
export const SERVER_DOTENV_PATH = path.join(SERVER_PACKAGE_DIR, ".env");

export const dotenvLoadResult = dotenv.config({ path: SERVER_DOTENV_PATH });

const rawKey = process.env.OPENAI_API_KEY;
if (rawKey !== undefined) {
  process.env.OPENAI_API_KEY = rawKey.replace(/^\uFEFF/, "").trim();
}
