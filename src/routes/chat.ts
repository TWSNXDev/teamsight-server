import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { openrouter, AI_MODEL } from "../ai.js";
import { buildSalesSummary, buildFactsBlock } from "../sales-context.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGE_LENGTH = 2000;

function isValidHistory(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length <= MAX_MESSAGE_LENGTH,
    )
  );
}

chatRouter.post("/", async (req, res) => {
  const { messages } = req.body;

  if (!isValidHistory(messages) || messages.length === 0) {
    res.status(400).json({ message: "Invalid chat history" });
    return;
  }

  const summary = await buildSalesSummary();
  const facts = buildFactsBlock(summary);

  const systemPrompt = `You are a helpful sales data assistant answering questions in fluent, natural English.
Only use the facts given below — never invent, estimate, or assume numbers that are not listed here. If the data cannot answer the question, say so plainly instead of guessing.
Keep answers short and conversational (1-3 sentences) unless the question needs more detail.

${facts}`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  const stream = await openrouter.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
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
