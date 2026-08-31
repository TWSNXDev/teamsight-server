import { prisma } from "./db.js";

export async function buildSalesSummary() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [thisWeek, lastWeek, byTeam] = await Promise.all([
    prisma.salesRecord.aggregate({
      where: { soldAt: { gte: sevenDaysAgo, lte: now } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.salesRecord.aggregate({
      where: { soldAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.salesRecord.groupBy({
      by: ["teamId"],
      where: { soldAt: { gte: sevenDaysAgo, lte: now } },
      _sum: { amount: true },
    }),
  ]);

  const teams = await prisma.team.findMany();
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const thisWeekTotal = Number(thisWeek._sum.amount ?? 0);
  const lastWeekTotal = Number(lastWeek._sum.amount ?? 0);
  const percentChange =
    lastWeekTotal === 0 ? null : ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;

  return {
    thisWeekTotal,
    thisWeekCount: thisWeek._count,
    lastWeekTotal,
    lastWeekCount: lastWeek._count,
    percentChange,
    byTeam: byTeam.map((t) => ({
      team: teamNameById.get(t.teamId) ?? "Unknown",
      total: Number(t._sum.amount ?? 0),
    })),
  };
}

export function buildFactsBlock(summary: Awaited<ReturnType<typeof buildSalesSummary>>) {
  const trendLine =
    summary.percentChange === null
      ? "No data from last week to compare against."
      : `Sales ${summary.percentChange >= 0 ? "increased" : "decreased"} by ${Math.abs(summary.percentChange).toFixed(1)}% compared to last week.`;

  return `Facts:
- This week's total sales: ${summary.thisWeekTotal} baht from ${summary.thisWeekCount} transactions.
- Last week's total sales: ${summary.lastWeekTotal} baht from ${summary.lastWeekCount} transactions.
- ${trendLine}
- Sales by team this week: ${summary.byTeam.map((t) => `${t.team} (${t.total} baht)`).join(", ") || "no team data recorded"}.`;
}
