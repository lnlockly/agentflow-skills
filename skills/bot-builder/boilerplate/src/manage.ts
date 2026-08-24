// Management CLI — the AGENT is the admin panel. Instead of a web dashboard, the
// agent runs these and reports in chat:
//   tsx src/manage.ts stats
//   tsx src/manage.ts referrals
//   tsx src/manage.ts broadcast "Привет 🔥 у нас акция" [tag]
import { bot } from "./bot.js";
import { overview, conversions, bySource } from "./features/analytics.js";
import { referralLeaderboard } from "./features/referral.js";
import { broadcast, segments } from "./features/broadcast.js";
import { linkStats } from "./features/tracking.js";

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "stats":
      console.log(JSON.stringify({
        overview: await overview(),
        conversions: await conversions(),
        sources: await bySource(),
        links: await linkStats(),
      }, null, 2));
      break;
    case "referrals":
      console.log(JSON.stringify(await referralLeaderboard(20), null, 2));
      break;
    case "broadcast": {
      const text = args[0];
      if (!text) { console.error('usage: manage broadcast "<text>" [tag]'); process.exit(2); }
      const where = args[1] ? segments.withTag(args[1]) : segments.all;
      const res = await broadcast(bot, text, where);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    default:
      console.error('commands: stats | referrals | broadcast "<text>" [tag]');
      process.exit(2);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
