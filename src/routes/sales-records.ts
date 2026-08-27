import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { io } from "../socket.js";

function canAccessTeam(user: AuthedRequest["user"], teamId: string) {
  if (user.role === "ADMIN") return true;
  return user.teamId === teamId;
}

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

salesRecordsRouter.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { product, amount, soldAt, teamId } = req.body;
  const user = (req as AuthedRequest).user;

  if (!canAccessTeam(user, teamId)) {
    res.status(403).json({ message: "Cannot create records for another team" });
    return;
  }

  const record = await prisma.salesRecord.create({
    data: {
      product,
      amount,
      soldAt: new Date(soldAt),
      teamId,
      recordedById: user.id,
    },
    include,
  });

  io.emit("sales-record:created", record);
  res.status(201).json(record);
});

salesRecordsRouter.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { product, amount, soldAt } = req.body;
  const user = (req as AuthedRequest).user;
  const id = String(req.params.id);

  const existing = await prisma.salesRecord.findUniqueOrThrow({
    where: { id },
  });

  if (!canAccessTeam(user, existing.teamId)) {
    res.status(403).json({ message: "Cannot edit records for another team" });
    return;
  }

  const record = await prisma.salesRecord.update({
    where: { id },
    data: {
      ...(product !== undefined && { product }),
      ...(amount !== undefined && { amount }),
      ...(soldAt !== undefined && { soldAt: new Date(soldAt) }),
    },
    include,
  });

  io.emit("sales-record:updated", record);
  res.json(record);
});

salesRecordsRouter.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const user = (req as AuthedRequest).user;
  const id = String(req.params.id);

  const existing = await prisma.salesRecord.findUniqueOrThrow({
    where: { id },
  });

  if (!canAccessTeam(user, existing.teamId)) {
    res.status(403).json({ message: "Cannot delete records for another team" });
    return;
  }

  await prisma.salesRecord.delete({ where: { id } });
  io.emit("sales-record:deleted", { id });
  res.status(204).send();
});
