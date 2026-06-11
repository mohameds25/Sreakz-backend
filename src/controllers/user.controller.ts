import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch } from "../middleware/access";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
  branchId: z.string().nullable().optional()
});

function getListLimit(req: Request) {
  const rawLimit = Number(req.query.limit);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return undefined;
  }
  return Math.min(Math.trunc(rawLimit), 10);
}

export async function listUsers(req: Request, res: Response) {
  const branchId = chooseScopedBranch(req);
  const users = await prisma.user.findMany({
    where: branchId ? { branchId } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, branchId: true, createdAt: true, branch: true },
    take: getListLimit(req)
  });
  if (req.query.summary === "true") {
    return res.json(users.map((user) => ({
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch?.name ?? "Global"
    })));
  }
  res.json(users);
}

export async function createUser(req: Request, res: Response) {
  const parsed = userSchema.safeParse(req.body);
  if (!req.user) {
    return res.status(401).json({ message: "Missing authenticated user" });
  }
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid user payload", issues: parsed.error.flatten() });
  }

  const userData = { ...parsed.data };
  if (req.user.role === Role.BRANCH_MANAGER) {
    const allowedBranchRoles: Role[] = [Role.CHEF, Role.WAITER];
    if (!allowedBranchRoles.includes(userData.role)) {
      return res.status(403).json({ message: "Branch managers can only create chefs and waiters" });
    }
    userData.branchId = req.user.branchId;
  }

  if (req.user.role === Role.HEADQUARTER_MANAGER) {
    const allowedHeadquarterRoles: Role[] = [Role.BRANCH_MANAGER, Role.CHEF, Role.WAITER, Role.CASHIER];
    if (!allowedHeadquarterRoles.includes(userData.role)) {
      return res.status(403).json({ message: "Headquarter can create branch staff only" });
    }
    if (!userData.branchId) {
      return res.status(400).json({ message: "Choose a branch for this staff account" });
    }
  }

  const { password, ...createData } = userData;
  const user = await prisma.user.create({
    data: { ...createData, passwordHash: await bcrypt.hash(password, 10) },
    select: { id: true, name: true, email: true, role: true, branchId: true, branch: true }
  });
  res.status(201).json(user);
}

export async function updateUser(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = userSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid user payload", issues: parsed.error.flatten() });
  }
  const { password, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id },
    data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    select: { id: true, name: true, email: true, role: true, branchId: true }
  });
  res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
  const id = String(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
}
