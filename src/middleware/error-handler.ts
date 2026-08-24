import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      res.status(404).json({ message: "Record not found" });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({ message: "Invalid reference (e.g. teamId does not exist)" });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
