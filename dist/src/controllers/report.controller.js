"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardReport = dashboardReport;
exports.branchReport = branchReport;
exports.salesReport = salesReport;
exports.inventoryReport = inventoryReport;
exports.lowStockReport = lowStockReport;
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
function branchWhere(req) {
    const branchId = (0, access_1.chooseScopedBranch)(req);
    return branchId ? { branchId } : undefined;
}
async function dashboardReport(req, res) {
    const where = branchWhere(req);
    const [branches, orders, bookings, sales, users, inventory] = await Promise.all([
        prisma_1.prisma.branch.count(),
        prisma_1.prisma.order.count({ where }),
        prisma_1.prisma.tableBooking.count({ where }),
        prisma_1.prisma.sale.findMany({ where, include: { branch: true } }),
        prisma_1.prisma.user.count(where ? { where } : undefined),
        prisma_1.prisma.inventoryItem.findMany({ where, include: { branch: true } })
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
async function branchReport(req, res) {
    const where = branchWhere(req);
    const branches = await prisma_1.prisma.branch.findMany({
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
async function salesReport(req, res) {
    const where = branchWhere(req);
    const sales = await prisma_1.prisma.sale.findMany({
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
async function inventoryReport(req, res) {
    const where = branchWhere(req);
    const inventory = await prisma_1.prisma.inventoryItem.findMany({
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
async function lowStockReport(req, res) {
    const where = branchWhere(req);
    const inventory = await prisma_1.prisma.inventoryItem.findMany({
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
