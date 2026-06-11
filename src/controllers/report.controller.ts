import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch } from "../middleware/access";

function branchWhere(req: Request) {
  const branchId = chooseScopedBranch(req);
  return branchId ? { branchId } : undefined;
}

export async function dashboardReport(req: Request, res: Response) {
  const where = branchWhere(req);
  const [branches, orders, bookings, sales, users, inventory] = await Promise.all([
    prisma.branch.count(),
    prisma.order.count({ where }),
    prisma.tableBooking.count({ where }),
    prisma.sale.findMany({ where, include: { branch: true } }),
    prisma.user.count(where ? { where } : undefined),
    prisma.inventoryItem.findMany({ where, include: { branch: true } })
  ]);
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.amount), 0);
  const lowStock = inventory.filter((item) => Number(item.quantity) <= Number(item.reorderLevel)).length;

  res.json({
    branches,
    orders,
    bookings,
    users,
    inventoryItems: inventory.length,
    lowStock,
    revenue
  });
}

export async function branchReport(req: Request, res: Response) {
  const where = branchWhere(req);
  const branches = await prisma.branch.findMany({
    where: where ? { id: where.branchId } : undefined,
    include: {
      _count: { select: { orders: true, bookings: true, users: true, inventory: true } },
      sales: true
    },
    orderBy: { name: "asc" }
  });

  res.json(branches.map((branch) => ({
    branch: branch.name,
    city: branch.city,
    orders: branch._count.orders,
    bookings: branch._count.bookings,
    users: branch._count.users,
    inventoryItems: branch._count.inventory,
    revenue: branch.sales.reduce((sum, sale) => sum + Number(sale.amount), 0)
  })));
}

export async function salesReport(req: Request, res: Response) {
  const where = branchWhere(req);
  const sales = await prisma.sale.findMany({
    where,
    include: { branch: true, order: { include: { items: true } }, cashier: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  res.json(sales.map((sale) => ({
    branch: sale.branch.name,
    cashier: sale.cashier.name,
    amount: Number(sale.amount),
    method: sale.paymentMethod,
    status: sale.status,
    items: sale.order.items.map((item) => `${item.quantity}x ${item.name}`).join(", "),
    createdAt: sale.createdAt
  })));
}

export async function inventoryReport(req: Request, res: Response) {
  const where = branchWhere(req);
  const inventory = await prisma.inventoryItem.findMany({
    where,
    include: { branch: true },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }]
  });

  res.json(inventory.map((item) => ({
    branch: item.branch.name,
    item: item.name,
    category: item.category,
    quantity: Number(item.quantity),
    unit: item.unit,
    reorderLevel: Number(item.reorderLevel),
    supplier: item.supplier
  })));
}

export async function lowStockReport(req: Request, res: Response) {
  const where = branchWhere(req);
  const inventory = await prisma.inventoryItem.findMany({
    where,
    include: { branch: true },
    orderBy: [{ branch: { name: "asc" } }, { name: "asc" }]
  });

  res.json(inventory
    .filter((item) => Number(item.quantity) <= Number(item.reorderLevel))
    .map((item) => ({
      branch: item.branch.name,
      item: item.name,
      quantity: Number(item.quantity),
      reorderLevel: Number(item.reorderLevel),
      unit: item.unit
    })));
}
