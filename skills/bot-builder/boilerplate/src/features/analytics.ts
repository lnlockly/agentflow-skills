// Funnel + growth analytics. All ORM. The agent calls these and reports in chat.
import { db } from "../db.js";

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

export async function overview() {
  const [total, today, week, blocked] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { joinedAt: { gte: since(1) } } }),
    db.user.count({ where: { joinedAt: { gte: since(7) } } }),
    db.user.count({ where: { blocked: true } }),
  ]);
  return { total, today, week, blocked };
}

/** Conversions grouped by type (funnel steps the bot records). */
export async function conversions() {
  const rows = await db.conversion.groupBy({ by: ["type"], _count: { _all: true }, _sum: { value: true } });
  return rows.map((r) => ({ type: r.type, count: r._count._all, value: r._sum.value ?? 0 }));
}

/** Acquisition by source (where users came from). */
export async function bySource() {
  const rows = await db.user.groupBy({
    by: ["source"],
    _count: { _all: true },
    orderBy: { _count: { source: "desc" } },
  });
  return rows.map((r) => ({ source: r.source ?? "direct", users: r._count._all }));
}
