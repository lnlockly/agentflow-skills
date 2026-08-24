// Referral + user onboarding. All ORM — no raw SQL.
// Deep-link entry points (t.me/<bot>?start=<payload>):
//   ref_<code>          → invited by the user who owns <code>
//   utm_<source>[_camp] → marketing source/campaign tracking
import { randomBytes } from "node:crypto";
import type { Context } from "grammy";
import { db } from "../db.js";
import { recordClick } from "./tracking.js";

export interface StartInfo {
  refCode?: string;
  source?: string;
  campaign?: string;
}

/** Parse a Telegram `/start <payload>`. Safe on empty/unknown payloads. */
export function parseStartPayload(payload?: string): StartInfo {
  const p = (payload ?? "").trim();
  if (!p) return {};
  if (p.startsWith("ref_")) return { refCode: p.slice(4) };
  if (p.startsWith("utm_")) {
    const [source, campaign] = p.slice(4).split("_", 2);
    return { source: source || "utm", campaign };
  }
  // Bare payload → treat as a source tag.
  return { source: p };
}

async function uniqueRefCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(4).toString("hex"); // 8 chars
    const exists = await db.user.findUnique({ where: { refCode: code } });
    if (!exists) return code;
  }
  return randomBytes(6).toString("hex");
}

/**
 * Find-or-create the user for this update, attributing referral + source on
 * FIRST contact only. Returns the user row. Call this in a middleware so every
 * handler downstream has the user in the DB.
 */
export async function ensureUser(ctx: Context, start?: StartInfo) {
  const from = ctx.from;
  if (!from) return null;
  const tgId = BigInt(from.id);

  const existing = await db.user.findUnique({ where: { tgId } });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { lastSeen: new Date(), username: from.username, firstName: from.first_name },
    });
    return existing;
  }

  // Resolve inviter (if a valid ref code that isn't the user themselves).
  let referredById: number | null = null;
  if (start?.refCode) {
    const inviter = await db.user.findUnique({ where: { refCode: start.refCode } });
    if (inviter && inviter.tgId !== tgId) referredById = inviter.id;
  }

  const user = await db.user.create({
    data: {
      tgId,
      username: from.username,
      firstName: from.first_name,
      refCode: await uniqueRefCode(),
      referredById,
      source: start?.source ?? (referredById ? "referral" : null),
      campaign: start?.campaign ?? null,
    },
  });

  // Record the acquisition click for link analytics.
  await recordClick(user.id, start?.source ?? (referredById ? "referral" : "direct"), start?.campaign);
  return user;
}

/** The share-link a user hands to friends. */
export function referralLink(botUsername: string, refCode: string): string {
  return `https://t.me/${botUsername}?start=ref_${refCode}`;
}

/** Top inviters (leaderboard). */
export async function referralLeaderboard(limit = 10) {
  const rows = await db.user.findMany({
    where: { referrals: { some: {} } },
    select: { username: true, firstName: true, refCode: true, _count: { select: { referrals: true } } },
    orderBy: { referrals: { _count: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({
    name: r.username ? `@${r.username}` : r.firstName ?? r.refCode,
    invited: r._count.referrals,
  }));
}
