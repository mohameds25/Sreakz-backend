"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrders = listOrders;
exports.getOrder = getOrder;
exports.createOrder = createOrder;
exports.updateOrderStatus = updateOrderStatus;
exports.updateOrder = updateOrder;
exports.deleteOrder = deleteOrder;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
const orderSchema = zod_1.z.object({
    branchId: zod_1.z.string(),
    tableNumber: zod_1.z.number().int().positive().optional(),
    customerName: zod_1.z.string().optional(),
    total: zod_1.z.coerce.number().nonnegative(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        quantity: zod_1.z.coerce.number().int().positive(),
        unitPrice: zod_1.z.coerce.number().nonnegative().optional()
    })).optional()
});
const menuPrices = {
    "Signature Ribeye": 48,
    "Filet Tenderloin": 56,
    "Steakz Burger": 29,
    "Tomahawk Board": 72,
    "Herb Chicken Grill": 34,
    "Salmon Ember Plate": 38
};
const menuRecipes = {
    "Signature Ribeye": [{ inventoryName: "Ribeye Steak", amount: 1 }],
    "Filet Tenderloin": [{ inventoryName: "Filet Tenderloin", amount: 1 }],
    "Steakz Burger": [{ inventoryName: "Beef Patties", amount: 1 }],
    "Tomahawk Board": [{ inventoryName: "Tomahawk Steak", amount: 1 }],
    "Herb Chicken Grill": [{ inventoryName: "Chicken Fillets", amount: 1 }],
    "Salmon Ember Plate": [{ inventoryName: "Salmon Fillet", amount: 1 }]
};
function getListLimit(req) {
    const rawLimit = Number(req.query.limit);
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
        return undefined;
    }
    return Math.min(Math.trunc(rawLimit), 10);
}
function wantsSummary(req) {
    return req.query.summary === "true";
}
async function listOrders(req, res) {
    const take = getListLimit(req);
    if (req.user?.role === client_1.Role.CUSTOMER) {
        const orders = await prisma_1.prisma.order.findMany({
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
    const branchId = (0, access_1.chooseScopedBranch)(req);
    const orders = await prisma_1.prisma.order.findMany({
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
async function getOrder(req, res) {
    const id = String(req.params.id);
    const order = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: { branch: true, createdBy: { select: { id: true, name: true, role: true } }, items: true, sale: true }
    });
    if (!order) {
        return res.status(404).json({ message: "Order not found" });
    }
    if (req.user?.role === client_1.Role.CUSTOMER && order.createdById !== req.user.id) {
        return res.status(403).json({ message: "Customers can only access their own orders" });
    }
    req.body.branchId = order.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        res.json(order);
    });
}
async function createOrder(req, res) {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
        return res.status(400).json({ message: "Invalid order payload", issues: parsed.success ? undefined : parsed.error.flatten() });
    }
    const { items, ...orderData } = parsed.data;
    async function createOrderAndDeductStock(createdById) {
        return prisma_1.prisma.$transaction(async (tx) => {
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
    if (req.user.role !== client_1.Role.CUSTOMER) {
        return (0, access_1.requireBranchScope)(req, res, async () => {
            const order = await createOrderAndDeductStock(req.user.id);
            res.status(201).json(order);
        });
    }
    const branch = await prisma_1.prisma.branch.findUnique({ where: { id: orderData.branchId } });
    if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
    }
    const order = await createOrderAndDeductStock(req.user.id);
    res.status(201).json(order);
}
async function updateOrderStatus(req, res) {
    const id = String(req.params.id);
    const parsed = zod_1.z.object({ status: zod_1.z.enum(["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"]) }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid order status", issues: parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.order.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Order not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const order = await prisma_1.prisma.order.update({ where: { id }, data: parsed.data });
        res.json(order);
    });
}
async function updateOrder(req, res) {
    const id = String(req.params.id);
    const parsed = orderSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid order payload", issues: parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.order.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Order not found" });
    }
    req.body.branchId = parsed.data.branchId || existing.branchId;
    const { items, ...orderData } = parsed.data;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const order = await prisma_1.prisma.$transaction(async (tx) => {
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
            await prisma_1.prisma.sale.updateMany({ where: { orderId: id }, data: { amount: orderData.total } });
        }
        res.json(order);
    });
}
async function deleteOrder(req, res) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.order.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Order not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        await prisma_1.prisma.sale.deleteMany({ where: { orderId: id } });
        await prisma_1.prisma.order.delete({ where: { id } });
        res.status(204).send();
    });
}
