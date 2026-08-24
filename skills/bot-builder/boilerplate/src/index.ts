// Entry point. Runs the bot with @grammyjs/runner (concurrent update handling).
import { run } from "@grammyjs/runner";
import { bot } from "./bot.js";

async function main() {
  await bot.init();
  console.log(`✅ @${bot.botInfo.username} is running (long polling).`);
  run(bot);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
