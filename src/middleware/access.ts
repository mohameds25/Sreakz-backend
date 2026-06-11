import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

const globalRoles: Role[] = [Role.HEADQUARTER_MANAGER, Role.ADMIN];

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden for this role" });
    }
    return next();
  };
}

export function requireBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Missing authenticated user" });
  }

  if (globalRoles.includes(req.user.role)) {
    return next();
  }

  const requestedBranchId = req.params.branchId || req.body.branchId || req.query.branchId;
  if (!requestedBranchId || requestedBranchId !== req.user.branchId) {
    return res.status(403).json({ message: "Branch users can only access their own branch" });
  }

  return next();
}

export function chooseScopedBranch(req: Request) {
  if (!req.user) {
    return undefined;
  }
  if (globalRoles.includes(req.user.role)) {
    return typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  }
  return req.user.branchId || undefined;
}
