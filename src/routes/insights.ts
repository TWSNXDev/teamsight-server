import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { openrouter, AI_MODEL } from "../ai.js";
import { buildSalesSummary, buildFactsBlock } from "../sales-context.js";

export const insightsRouter = Router();

insightsRouter.use(requireAuth);

insightsRouter.post("/", async (_req, res) => {
  const summary = await buildSalesSummary();
  const facts = buildFactsBlock(summary);

  const prompt = `You are a sales analyst writing a short briefing for a busy manager, in fluent, natural English.

Write 2-4 flowing sentences that explain what happened and why it matters. Use the numbers as supporting evidence woven into the sentences, not as a checklist.
Only use the facts given below — never invent, estimate, or assume numbers that are not listed here. If something can't be concluded from this data, say so plainly.

${facts}`;

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
