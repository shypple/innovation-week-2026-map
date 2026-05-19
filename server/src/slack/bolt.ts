import type { FastifyInstance } from "fastify";
import { App } from "@slack/bolt";

export async function maybeStartSlack(app: FastifyInstance): Promise<void> {
  const enabled = process.env.SLACK_ENABLE === "1" || process.env.SLACK_ENABLE === "true";
  const token = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!enabled) {
    app.log.info("Slack Bolt disabled (set SLACK_ENABLE=1 and tokens to enable Socket Mode).");
    return;
  }

  if (!token || !appToken) {
    app.log.warn("Slack enabled but SLACK_BOT_TOKEN / SLACK_APP_TOKEN missing — skipping Bolt.");
    return;
  }

  const slack = new App({
    token,
    appToken,
    socketMode: true,
  });

  slack.command("/sanctions-triage", async ({ command, ack, respond }) => {
    await ack();
    const text = command.text?.trim() ?? "";
    if (!text) {
      await respond(
        "Usage: `/sanctions-triage Can we ship dual-use electronics to DE for customer Foo?` — then open the web UI for the map + full brief.",
      );
      return;
    }

    const origin = process.env.PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`;
    const res = await fetch(`${origin}/api/parse-and-evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      await respond(`API error (${res.status}). Is the server reachable from Slack (PUBLIC_API_BASE_URL)?`);
      return;
    }

    const payload = (await res.json()) as {
      parsed: unknown;
      evaluate: { result: { tier: string; summary: string } } | null;
      message?: string;
      usedLlm: boolean;
    };

    if (!payload.evaluate) {
      await respond(
        `${payload.message ?? "Could not evaluate."}\nParsed: \`\`\`${JSON.stringify(payload.parsed, null, 2)}\`\`\``,
      );
      return;
    }

    await respond(
      [
        `*Tier:* ${payload.evaluate.result.tier} ${payload.usedLlm ? "(LLM parse)" : "(heuristic parse)"}`,
        `*Summary:* ${payload.evaluate.result.summary}`,
        `_Indicative only — not legal advice._`,
      ].join("\n"),
    );
  });

  await slack.start();
  app.log.info("Slack Bolt (Socket Mode) connected.");
}
