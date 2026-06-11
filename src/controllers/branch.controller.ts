import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const branchSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(5),
  phone: z.string().min(5)
});

export async function listBranches(_req: Request, res: Response) {
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
  res.json(branches);
}

export async function createBranch(req: Request, res: Response) {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid branch payload", issues: parsed.error.flatten() });
  }
  const passwordHash = await bcrypt.hash("123456", 10);
  const key = parsed.data.city.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "") || `branch.${Date.now()}`;
  const branch = await prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({ data: parsed.data });
    await tx.user.createMany({
      data: [
        { name: `${parsed.data.city} Branch Manager`, email: `manager.${key}@steakz.test`, passwordHash, role: Role.BRANCH_MANAGER, branchId: created.id },
        { name: `${parsed.data.city} Chef`, email: `chef.${key}@steakz.test`, passwordHash, role: Role.CHEF, branchId: created.id },
        { name: `${parsed.data.city} Waiter`, email: `waiter.${key}@steakz.test`, passwordHash, role: Role.WAITER, branchId: created.id },
        { name: `${parsed.data.city} Cashier`, email: `cashier.${key}@steakz.test`, passwordHash, role: Role.CASHIER, branchId: created.id }
      ],
      skipDuplicates: true
    });
    return created;
  });
  res.status(201).json(branch);
}

export async function updateBranch(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = branchSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid branch payload", issues: parsed.error.flatten() });
  }
  const branch = await prisma.branch.update({ where: { id }, data: parsed.data });
  res.json(branch);
}

export async function deleteBranch(req: Request, res: Response) {
  const id = String(req.params.id);
  await prisma.user.updateMany({ where: { branchId: id }, data: { branchId: null } });
  await prisma.branch.delete({ where: { id } });
  res.status(204).send();
}
