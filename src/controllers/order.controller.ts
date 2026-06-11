import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch, requireBranchScope } from "../middleware/access";

const orderSchema = z.object({
  branchId: z.string(),
  tableNumber: z.number().int().positive().optional(),
  customerName: z.string().optional(),
  total: z.coerce.number().nonnegative(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative().optional()
  })).optional()
});

const menuPrices: Record<string, number> = {
  "Signature Ribeye": 48,
  "Filet Tenderloin": 56,
  "Steakz Burger": 29,
  "Tomahawk Board": 72,
  "Herb Chicken Grill": 34,
  "Salmon Ember Plate": 38
};

const menuRecipes: Record<string, Array<{ inventoryName: string; amount: number }>> = {
  "Signature Ribeye": [{ inventoryName: "Ribeye Steak", amount: 1 }],
  "Filet Tenderloin": [{ inventoryName: "Filet Tenderloin", amount: 1 }],
  "Steakz Burger": [{ inventoryName: "Beef Patties", amount: 1 }],
  "Tomahawk Board": [{ inventoryName: "Tomahawk Steak", amount: 1 }],
  "Herb Chicken Grill": [{ inventoryName: "Chicken Fillets", amount: 1 }],
  "Salmon Ember Plate": [{ inventoryName: "Salmon Fillet", amount: 1 }]
};

function getListLimit(req: Request) {
  const rawLimit = Number(req.query.limit);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return undefined;
  }
  return Math.min(Math.trunc(rawLimit), 10);
}

function wantsSummary(req: Request) {
  return req.query.summary === "true";
}

export async function listOrders(req: Request, res: Response) {
  const take = getListLimit(req);
  if (req.user?.role === Role.CUSTOMER) {
    const orders = await prisma.order.findMany({
      where: { createdById: req.user.id },
      include: { branch: true, createdBy: { select: { id: true, name: true, role: true } }, items: true, sale: true },
      orderBy: { createdAt: "desc" },
      take
    });
    if (wantsSummary(req)) {
      return res.json(orders.map((order) => ({
        order: order.customerName ?? "Customer order",
        branch: order.branch.name,
        status: order.status,
        total: `£${Number(order.total).toFixed(2)}`
      })));
    }
    return res.json(orders);
  }

  const branchId = chooseScopedBranch(req);
  const orders = await prisma.order.findMany({
    where: branchId ? { branchId } : undefined,
    include: { branch: true, createdBy: { select: { id: true, name: true, role: true } }, items: true, sale: true },
    orderBy: { createdAt: "desc" },
    take
  });
  if (wantsSummary(req)) {
    return res.json(orders.map((order) => ({
      order: order.customerName ?? "Walk-in order",
      branch: order.branch.name,
      createdBy: order.createdBy.name,
      role: order.createdBy.role,
      status: order.status,
      total: `£${Number(order.total).toFixed(2)}`
    })));
  }
  res.json(orders);
}

export async function getOrder(req: Request, res: Response) {
  const id = String(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { branch: true, createdBy: { select: { id: true, name: true, role: true } }, items: true, sale: true }
  });
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (req.user?.role === Role.CUSTOMER && order.createdById !== req.user.id) {
    return res.status(403).json({ message: "Customers can only access their own orders" });
  }

  req.body.branchId = order.branchId;
  requireBranchScope(req, res, async () => {
    res.json(order);
  });
}

export async function createOrder(req: Request, res: Response) {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success || !req.user) {
    return res.status(400).json({ message: "Invalid order payload", issues: parsed.success ? undefined : parsed.error.flatten() });
  }
  const { items, ...orderData } = parsed.data;

  async function createOrderAndDeductStock(createdById: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data: { ...orderData, createdById } });
      for (const item of items ?? []) {
        const unitPrice = item.unitPrice ?? menuPrices[item.name] ?? 0;
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice,
            lineTotal: unitPrice * item.quantity
          }
        });
        for (const recipe of menuRecipes[item.name] ?? []) {
          const inventory = await tx.inventoryItem.findFirst({
            where: {
              branchId: orderData.branchId,
              name: recipe.inventoryName
            }
          });
          if (inventory) {
            const nextQuantity = Math.max(0, Number(inventory.quantity) - recipe.amount * item.quantity);
            await tx.inventoryItem.update({
              where: { id: inventory.id },
              data: { quantity: nextQuantity }
            });
          }
        }
      }
      await tx.sale.create({
        data: {
          branchId: orderData.branchId,
          orderId: order.id,
          cashierId: createdById,
          amount: orderData.total,
          paymentMethod: "Card"
        }
      });
      return tx.order.findUnique({
        where: { id: order.id },
        include: { branch: true, createdBy: { select: { id: true, name: true, role: true } }, items: true, sale: true }
      });
    });
  }

  if (req.user.role !== Role.CUSTOMER) {
    return requireBranchScope(req, res, async () => {
      const order = await createOrderAndDeductStock(req.user!.id);
      res.status(201).json(order);
    });
  }

  const branch = await prisma.branch.findUnique({ where: { id: orderData.branchId } });
  if (!branch) {
    return res.status(404).json({ message: "Branch not found" });
  }

  const order = await createOrderAndDeductStock(req.user.id);
  res.status(201).json(order);
}

export async function updateOrderStatus(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = z.object({ status: z.enum(["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"]) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order status", issues: parsed.error.flatten() });
  }
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Order not found" });
  }
  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    const order = await prisma.order.update({ where: { id }, data: parsed.data });
    res.json(order);
  });
}

export async function updateOrder(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = orderSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid order payload", issues: parsed.error.flatten() });
  }
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Order not found" });
  }
  req.body.branchId = parsed.data.branchId || existing.branchId;
  const { items, ...orderData } = parsed.data;
  requireBranchScope(req, res, async () => {
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id }, data: orderData });
      if (items) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        for (const item of items) {
          const unitPrice = item.unitPrice ?? menuPrices[item.name] ?? 0;
          await tx.orderItem.create({
            data: {
              orderId: id,
              name: item.name,
              quantity: item.quantity,
              unitPrice,
              lineTotal: unitPrice * item.quantity
            }
          });
        }
      }
      return tx.order.findUnique({
        where: { id: updated.id },
        include: { branch: true, createdBy: { select: { id: true, name: true, role: true } }, items: true, sale: true }
      });
    });
    if (orderData.total !== undefined) {
      await prisma.sale.updateMany({ where: { orderId: id }, data: { amount: orderData.total } });
    }
    res.json(order);
  });
}

export async function deleteOrder(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Order not found" });
  }
  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    await prisma.sale.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });
    res.status(204).send();
  });
}
