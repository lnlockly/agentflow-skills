// Validated env — the ONE place config enters the app (system boundary).
import { z } from "zod";
import { existsSync } from "node:fs";

// Load a local .env when present (dev / pod-manual runs). In production the CP
// injects env into the container, so there's no .env and this is a no-op.
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  try { process.loadEnvFile(".env"); } catch { /* ignore */ }
}

const schema = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN is required"),
  DATABASE_URL: z.string().default("file:./data/bot.db"),
  SITE_URL: z.string().url().default("https://agentflow.website"),
  BOT_USERNAME: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid config:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
