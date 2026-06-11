"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInventory = listInventory;
exports.createInventoryItem = createInventoryItem;
exports.updateInventoryItem = updateInventoryItem;
exports.refillInventoryItem = refillInventoryItem;
exports.useInventoryItem = useInventoryItem;
exports.deleteInventoryItem = deleteInventoryItem;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
const inventorySchema = zod_1.z.object({
    branchId: zod_1.z.string(),
    name: zod_1.z.string().min(2),
    category: zod_1.z.string().min(2),
    quantity: zod_1.z.coerce.number().nonnegative(),
    unit: zod_1.z.string().min(1),
    reorderLevel: zod_1.z.coerce.number().nonnegative(),
    supplier: zod_1.z.string().min(2)
});
const refillSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive()
});
function getListLimit(req) {
    const rawLimit = Number(req.query.limit);
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
        return undefined;
    }
    return Math.min(Math.trunc(rawLimit), 10);
}
async function listInventory(req, res) {
    const branchId = (0, access_1.chooseScopedBranch)(req);
    const inventory = await prisma_1.prisma.inventoryItem.findMany({
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
async function createInventoryItem(req, res) {
    const parsed = inventorySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid inventory payload", issues: parsed.error.flatten() });
    }
    const item = await prisma_1.prisma.inventoryItem.create({ data: parsed.data });
    res.status(201).json(item);
}
async function updateInventoryItem(req, res) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Inventory item not found" });
    }
    req.body.branchId = req.body.branchId || existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const parsed = inventorySchema.partial().safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid inventory payload", issues: parsed.error.flatten() });
        }
        const item = await prisma_1.prisma.inventoryItem.update({ where: { id }, data: parsed.data });
        res.json(item);
    });
}
async function changeInventoryQuantity(req, res, direction) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Inventory item not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const parsed = refillSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid refill payload", issues: parsed.error.flatten() });
        }
        const currentQuantity = Number(existing.quantity);
        const nextQuantity = direction === "add"
            ? currentQuantity + parsed.data.amount
            : Math.max(0, currentQuantity - parsed.data.amount);
        const item = await prisma_1.prisma.inventoryItem.update({
            where: { id },
            data: { quantity: nextQuantity },
            include: { branch: true }
        });
        res.json(item);
    });
}
async function refillInventoryItem(req, res) {
    return changeInventoryQuantity(req, res, "add");
}
async function useInventoryItem(req, res) {
    return changeInventoryQuantity(req, res, "subtract");
}
async function deleteInventoryItem(req, res) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Inventory item not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        await prisma_1.prisma.inventoryItem.delete({ where: { id } });
        res.status(204).send();
    });
}
