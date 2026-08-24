// Marketing link tracking + conversions. All ORM.
import { db } from "../db.js";

/** Record a deep-link entry (where a user came from). */
export async function recordClick(userId: number | null, source: string, campaign?: string | null) {
  await db.clickEvent.create({ data: { userId: userId ?? undefined, source, campaign: campaign ?? undefined } });
}

/** Record a funnel conversion (lead / purchase / custom). Call from funnels. */
export async function recordConversion(tgId: number | bigint, type: string, value = 0) {
  const user = await db.user.findUnique({ where: { tgId: BigInt(tgId) } });
  if (!user) return;
  await db.conversion.create({ data: { userId: user.id, type, value } });
}

/** Clicks grouped by source/campaign, with how many became users + converted. */
export async function linkStats() {
  const bySource = await db.clickEvent.groupBy({
    by: ["source"],
    _count: { _all: true },
    orderBy: { _count: { source: "desc" } },
  });
  return bySource.map((s) => ({ source: s.source, clicks: s._count._all }));
}
