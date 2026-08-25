import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/require-auth.js";

export const teamsRouter = Router();

teamsRouter.use(requireAuth);

teamsRouter.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  res.json(teams);
});
