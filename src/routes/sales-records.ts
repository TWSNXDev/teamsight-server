import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { io } from "../socket.js";

function canAccessTeam(user: AuthedRequest["user"], teamId: string) {
  if (user.role === "ADMIN") return true;
  return user.teamId === teamId;
}

interface RecordInput {
  product?: unknown;
  amount?: unknown;
  soldAt?: unknown;
}

function validateRecordInput(
  body: RecordInput,
  { requireAll }: { requireAll: boolean },
): string | null {
  const { product, amount, soldAt } = body;

  if (product !== undefined || requireAll) {
    if (typeof product !== "string" || product.trim().length === 0 || product.length > 200) {
      return "Product must be a non-empty string under 200 characters";
    }
  }

  if (amount !== undefined || requireAll) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      return "Amount must be a positive number";
    }
  }

  if (soldAt !== undefined || requireAll) {
    if (typeof soldAt !== "string" || Number.isNaN(new Date(soldAt).getTime())) {
      return "Sold at must be a valid date";
    }
  }

  return null;
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

  if (typeof teamId !== "string" || teamId.trim().length === 0) {
    res.status(400).json({ message: "teamId is required" });
    return;
  }

  const validationError = validateRecordInput(req.body, { requireAll: true });
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

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
  const { product, amount, soldAt, expectedUpdatedAt } = req.body;
  const user = (req as AuthedRequest).user;
  const id = String(req.params.id);

  const validationError = validateRecordInput(req.body, { requireAll: false });
  if (validationError) {
    res.status(400).json({ message: validationError });
    return;
  }

  const existing = await prisma.salesRecord.findUniqueOrThrow({
    where: { id },
  });

  if (!canAccessTeam(user, existing.teamId)) {
    res.status(403).json({ message: "Cannot edit records for another team" });
    return;
  }

  if (
    expectedUpdatedAt &&
    new Date(expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()
  ) {
    res.status(409).json({
      message: "This record was changed by someone else. Please refresh and try again.",
      current: existing,
    });
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
