import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch, requireBranchScope } from "../middleware/access";

const inventorySchema = z.object({
  branchId: z.string(),
  name: z.string().min(2),
  category: z.string().min(2),
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().min(1),
  reorderLevel: z.coerce.number().nonnegative(),
  supplier: z.string().min(2)
});

const refillSchema = z.object({
  amount: z.coerce.number().positive()
});

function getListLimit(req: Request) {
  const rawLimit = Number(req.query.limit);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return undefined;
  }
  return Math.min(Math.trunc(rawLimit), 10);
}

export async function listInventory(req: Request, res: Response) {
  const branchId = chooseScopedBranch(req);
  const inventory = await prisma.inventoryItem.findMany({
    where: branchId ? { branchId } : undefined,
    include: { branch: true },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    take: getListLimit(req)
  });
  if (req.query.summary === "true") {
    return res.json(inventory.map((item) => ({
      item: item.name,
      category: item.category,
      branch: item.branch.name,
      quantity: `${Number(item.quantity)} ${item.unit}`,
      reorderLevel: `${Number(item.reorderLevel)} ${item.unit}`
    })));
  }
  res.json(inventory);
}

export async function createInventoryItem(req: Request, res: Response) {
  const parsed = inventorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid inventory payload", issues: parsed.error.flatten() });
  }
  const item = await prisma.inventoryItem.create({ data: parsed.data });
  res.status(201).json(item);
}

export async function updateInventoryItem(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Inventory item not found" });
  }
  req.body.branchId = req.body.branchId || existing.branchId;
  requireBranchScope(req, res, async () => {
    const parsed = inventorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid inventory payload", issues: parsed.error.flatten() });
    }
    const item = await prisma.inventoryItem.update({ where: { id }, data: parsed.data });
    res.json(item);
  });
}

async function changeInventoryQuantity(req: Request, res: Response, direction: "add" | "subtract") {
  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Inventory item not found" });
  }
  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    const parsed = refillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid refill payload", issues: parsed.error.flatten() });
    }
    const currentQuantity = Number(existing.quantity);
    const nextQuantity = direction === "add"
      ? currentQuantity + parsed.data.amount
      : Math.max(0, currentQuantity - parsed.data.amount);
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { quantity: nextQuantity },
      include: { branch: true }
    });
    res.json(item);
  });
}

export async function refillInventoryItem(req: Request, res: Response) {
  return changeInventoryQuantity(req, res, "add");
}

export async function useInventoryItem(req: Request, res: Response) {
  return changeInventoryQuantity(req, res, "subtract");
}

export async function deleteInventoryItem(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Inventory item not found" });
  }
  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    await prisma.inventoryItem.delete({ where: { id } });
    res.status(204).send();
  });
}
