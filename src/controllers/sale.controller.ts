import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch, requireBranchScope } from "../middleware/access";

const saleSchema = z.object({
  branchId: z.string(),
  orderId: z.string(),
  amount: z.coerce.number().nonnegative(),
  paymentMethod: z.string().min(2)
});

export async function listSales(req: Request, res: Response) {
  const branchId = chooseScopedBranch(req);
  const sales = await prisma.sale.findMany({
    where: branchId ? { branchId } : undefined,
    include: { branch: true, order: true, cashier: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(sales);
}

export async function createSale(req: Request, res: Response) {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success || !req.user) {
    return res.status(400).json({ message: "Invalid sale payload", issues: parsed.success ? undefined : parsed.error.flatten() });
  }
  const existing = await prisma.sale.findUnique({ where: { orderId: parsed.data.orderId } });
  if (existing) {
    req.body.branchId = existing.branchId;
    return requireBranchScope(req, res, async () => {
      const sale = await prisma.sale.update({
        where: { id: existing.id },
        data: { amount: parsed.data.amount, paymentMethod: parsed.data.paymentMethod, cashierId: req.user!.id }
      });
      res.json(sale);
    });
  }
  const sale = await prisma.sale.create({ data: { ...parsed.data, cashierId: req.user.id } });
  res.status(201).json(sale);
}

export async function deleteSale(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Sale not found" });
  }
  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    await prisma.sale.delete({ where: { id } });
    res.status(204).send();
  });
}
