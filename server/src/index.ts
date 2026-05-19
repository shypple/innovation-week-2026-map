import "./loadEnv.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes.js";
import { maybeStartSlack } from "./slack/bolt.js";
import { SERVER_DOTENV_PATH, dotenvLoadResult } from "./loadEnv.js";

const port = Number(process.env.PORT ?? 8787);

/** Comma-separated list; defaults allow local Vite UI + e.g. Next dashboard on :3000. */
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
  });

  await registerRoutes(app);

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${port}`);
  if (dotenvLoadResult.error) {
    app.log.warn(
      { path: SERVER_DOTENV_PATH, err: dotenvLoadResult.error.message },
      "dotenv could not load .env (using process env only)",
    );
  } else {
    app.log.info({ path: SERVER_DOTENV_PATH }, "Loaded server/.env");
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    app.log.info(
      { baseUrl: process.env.OPENAI_BASE_URL ?? "(default OpenAI)", model: process.env.OPENAI_MODEL ?? "(sdk default)" },
      "LLM parse: OPENAI_API_KEY is set",
    );
  } else {
    app.log.warn("LLM parse: OPENAI_API_KEY missing — using heuristic parse only (check server/.env path).");
  }

  void maybeStartSlack(app).catch((err) => {
    app.log.error(err, "Slack Bolt failed to start");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
