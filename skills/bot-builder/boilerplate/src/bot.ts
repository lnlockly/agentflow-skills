// The bot instance + middleware wiring. Funnels are CODE (grammY conversations),
// not JSON — so a simple flow is ~20 lines and complex logic is just more code.
import { Bot, Context, session, type SessionFlavor } from "grammy";
import { conversations, createConversation, type ConversationFlavor } from "@grammyjs/conversations";
import { config } from "./config.js";
import { db } from "./db.js";
import { ensureUser, parseStartPayload, referralLink } from "./features/referral.js";
import { activeFunnel, ACTIVE_NAME } from "./funnels/active.js";

interface SessionData {}
export type MyContext = ConversationFlavor<Context & SessionFlavor<SessionData>>;

export const bot = new Bot<MyContext>(config.BOT_TOKEN);

// Sessions (required by conversations) + the conversations engine.
bot.use(session({ initial: (): SessionData => ({}) }));
bot.use(conversations());

// Register the active funnel (each is a normal async function — see funnels/).
bot.use(createConversation(activeFunnel, ACTIVE_NAME));

// On every update: find-or-create the user, attributing referral/UTM from a
// /start deep-link on first contact. Idempotent + cheap.
bot.use(async (ctx, next) => {
  const text = ctx.message?.text ?? "";
  const start = text.startsWith("/start")
    ? parseStartPayload(text.split(/\s+/).slice(1).join(" "))
    : undefined;
  await ensureUser(ctx, start);
  await next();
});

// Entry point → run the welcome funnel.
bot.command("start", async (ctx) => {
  await ctx.conversation.enter(ACTIVE_NAME);
});

// Built-in: user sees their own referral link + how many they invited.
bot.command("ref", async (ctx) => {
  const me = await db.user.findUnique({
    where: { tgId: BigInt(ctx.from!.id) },
    include: { _count: { select: { referrals: true } } },
  });
  if (!me) return;
  const uname = config.BOT_USERNAME || ctx.me.username;
  await ctx.reply(
    `🔗 Твоя реферальная ссылка:\n${referralLink(uname, me.refCode)}\n\n` +
      `Пригласил друзей: <b>${me._count.referrals}</b>`,
    { parse_mode: "HTML" },
  );
});

bot.catch((err) => console.error("bot error:", err.error));
