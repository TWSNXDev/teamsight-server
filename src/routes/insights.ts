import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/require-auth.js";
import { openrouter, AI_MODEL } from "../ai.js";

export const insightsRouter = Router();

insightsRouter.use(requireAuth);

async function buildSalesSummary() {
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

function buildPrompt(summary: Awaited<ReturnType<typeof buildSalesSummary>>) {
  const trendLine =
    summary.percentChange === null
      ? "No data from last week to compare against."
      : `Sales ${summary.percentChange >= 0 ? "increased" : "decreased"} by ${Math.abs(summary.percentChange).toFixed(1)}% compared to last week.`;

  return `You are a sales analyst writing a short briefing for a busy manager, in fluent, natural Thai (not a literal translation, not a list of numbers restated one by one).

Write 2-4 flowing sentences that explain what happened and why it matters. Use the numbers as supporting evidence woven into the sentences, not as a checklist.
Only use the facts given below — never invent, estimate, or assume numbers that are not listed here. If something can't be concluded from this data, say so plainly.
When writing currency amounts in Thai, use "บาท" only — never "บาทไทย" or "THB".

Facts:
- This week's total sales: ${summary.thisWeekTotal} baht from ${summary.thisWeekCount} transactions.
- Last week's total sales: ${summary.lastWeekTotal} baht from ${summary.lastWeekCount} transactions.
- ${trendLine}
- Sales by team this week: ${summary.byTeam.map((t) => `${t.team} (${t.total} baht)`).join(", ") || "no team data recorded"}.`;
}

insightsRouter.post("/", async (_req, res) => {
  const summary = await buildSalesSummary();
  const prompt = buildPrompt(summary);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  const stream = await openrouter.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      res.write(text);
    }
  }

  res.end();
});
