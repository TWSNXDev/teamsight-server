import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/require-auth.js";

export const salesRecordsRouter = Router();

salesRecordsRouter.use(requireAuth);

const include = {
  team: true,
  recordedBy: { select: { id: true, name: true } },
} as const;

salesRecordsRouter.get("/", async (req, res) => {
  const { teamId } = req.query;

  const records = await prisma.salesRecord.findMany({
    where: teamId ? { teamId: String(teamId) } : undefined,
    orderBy: { soldAt: "desc" },
    include,
  });

  res.json(records);
});

salesRecordsRouter.post("/", async (req, res) => {
  const { product, amount, soldAt, teamId } = req.body;
  const userId = (req as AuthedRequest).user.id;

  const record = await prisma.salesRecord.create({
    data: {
      product,
      amount,
      soldAt: new Date(soldAt),
      teamId,
      recordedById: userId,
    },
    include,
  });

  res.status(201).json(record);
});

salesRecordsRouter.patch("/:id", async (req, res) => {
  const { product, amount, soldAt } = req.body;

  const record = await prisma.salesRecord.update({
    where: { id: req.params.id },
    data: {
      ...(product !== undefined && { product }),
      ...(amount !== undefined && { amount }),
      ...(soldAt !== undefined && { soldAt: new Date(soldAt) }),
    },
    include,
  });

  res.json(record);
});

salesRecordsRouter.delete("/:id", async (req, res) => {
  await prisma.salesRecord.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
