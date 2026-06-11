import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch, requireBranchScope } from "../middleware/access";

const shiftSchema = z.object({
  branchId: z.string(),
  userId: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED"]).optional()
});

export async function listShifts(req: Request, res: Response) {
  const branchId = chooseScopedBranch(req);
  const shifts = await prisma.shift.findMany({
    where: branchId ? { branchId } : undefined,
    include: { branch: true, user: { select: { id: true, name: true, role: true } } },
    orderBy: { startsAt: "asc" }
  });
  res.json(shifts);
}

export async function createShift(req: Request, res: Response) {
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid shift payload", issues: parsed.error.flatten() });
  }
  const shift = await prisma.shift.create({ data: parsed.data });
  res.status(201).json(shift);
}

export async function updateShift(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Shift not found" });
  }
  req.body.branchId = req.body.branchId || existing.branchId;
  requireBranchScope(req, res, async () => {
    const parsed = shiftSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid shift payload", issues: parsed.error.flatten() });
    }
    const shift = await prisma.shift.update({ where: { id }, data: parsed.data });
    res.json(shift);
  });
}
