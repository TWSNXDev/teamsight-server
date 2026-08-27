import type { NextFunction, Request, Response } from "express";
import type { AuthedRequest } from "./require-auth.js";

type Role = "ADMIN" | "MANAGER" | "VIEWER";

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as AuthedRequest).user.role as Role;

    if (!allowedRoles.includes(role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
}
