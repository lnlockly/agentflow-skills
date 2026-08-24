// EXAMPLE FUNNEL — as code, via grammY conversations. This is the pattern the
// agent copies and rewrites per bot. A simple funnel is ~20 lines; for anything
// harder (branches, API calls, payments, dynamic content) you just write more
// code — no JSON ceiling.
//
// IMPORTANT: side-effects (DB writes, API calls) inside a conversation MUST be
// wrapped in `conversation.external(...)` so grammY's replay engine runs them
// exactly once.
import type { Conversation } from "@grammyjs/conversations";
import { InlineKeyboard } from "grammy";
import type { MyContext } from "../bot.js";
import { recordConversion } from "../features/tracking.js";

export async function welcome(conversation: Conversation<MyContext>, ctx: MyContext) {
  const name = ctx.from?.first_name ?? "друг";

  const kb = new InlineKeyboard().text("Да, хочу 🔥", "want").text("Позже", "later");
  await ctx.reply(
    `Привет, ${name}! 👋\n\nЭто демо-воронка. Хочешь узнать, как это работает?`,
    { reply_markup: kb },
  );

  const cq = await conversation.waitForCallbackQuery(["want", "later"]);
  await cq.answerCallbackQuery();

  if (cq.callbackQuery.data === "want") {
    // Record a funnel conversion (shows up in analytics).
    await conversation.external(() => recordConversion(ctx.from!.id, "lead"));
    await ctx.reply(
      "Огонь! 🚀\n\nЗдесь дальше идёт твой оффер / шаги / оплата — что угодно.\n" +
        "Набери /ref, чтобы получить свою реферальную ссылку.",
    );
  } else {
    await ctx.reply("Понял, не тороплю 🙂 Напиши /start, когда будешь готов.");
  }
}
