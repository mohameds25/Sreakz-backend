import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  branchId: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
