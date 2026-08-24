import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

export interface AuthedRequest extends Request {
  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  (req as AuthedRequest).user = session.user;
  next();
}
