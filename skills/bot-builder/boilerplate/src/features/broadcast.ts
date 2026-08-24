// Mailing / broadcast. Segmented + rate-limited. All ORM.
import type { Bot } from "grammy";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send `text` to a segment of users. `where` is a Prisma User filter — the agent
 * can target anything (a tag, a source, non-converters, joined-after-date, …).
 * Omit it to reach everyone. Blocked users are skipped + auto-flagged on 403.
 * Throttled to respect Telegram's ~30 msg/s limit. Returns {sent, failed}.
 */
export async function broadcast(
  bot: Bot<any>,
  text: string,
  where: Prisma.UserWhereInput = {},
  opts: { perSecond?: number } = {},
) {
  const perSecond = Math.min(opts.perSecond ?? 25, 28);
  const delay = Math.ceil(1000 / perSecond);

  const users = await db.user.findMany({ where: { blocked: false, ...where }, select: { id: true, tgId: true } });
  let sent = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await bot.api.sendMessage(Number(u.tgId), text, { parse_mode: "HTML" });
      sent++;
    } catch (e: any) {
      failed++;
      // 403 = user blocked the bot → stop bothering them in future runs.
      if (e?.error_code === 403) {
        await db.user.update({ where: { id: u.id }, data: { blocked: true } }).catch(() => {});
      }
    }
    await sleep(delay);
  }

  await db.broadcast.create({ data: { segment: JSON.stringify(where) || null, text, sent, failed } });
  return { sent, failed, total: users.length };
}

/** Convenience segments the agent can pass as `where`. */
export const segments = {
  all: {} as Prisma.UserWhereInput,
  withTag: (tag: string): Prisma.UserWhereInput => ({ tags: { contains: tag } }),
  fromSource: (source: string): Prisma.UserWhereInput => ({ source }),
  notConverted: (type: string): Prisma.UserWhereInput => ({ conversions: { none: { type } } }),
  converted: (type: string): Prisma.UserWhereInput => ({ conversions: { some: { type } } }),
};
