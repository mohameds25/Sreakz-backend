"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSales = listSales;
exports.createSale = createSale;
exports.deleteSale = deleteSale;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
const saleSchema = zod_1.z.object({
    branchId: zod_1.z.string(),
    orderId: zod_1.z.string(),
    amount: zod_1.z.coerce.number().nonnegative(),
    paymentMethod: zod_1.z.string().min(2)
});
async function listSales(req, res) {
    const branchId = (0, access_1.chooseScopedBranch)(req);
    const sales = await prisma_1.prisma.sale.findMany({
        where: branchId ? { branchId } : undefined,
        include: { branch: true, order: true, cashier: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" }
    });
    res.json(sales);
}
async function createSale(req, res) {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
        return res.status(400).json({ message: "Invalid sale payload", issues: parsed.success ? undefined : parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.sale.findUnique({ where: { orderId: parsed.data.orderId } });
    if (existing) {
        req.body.branchId = existing.branchId;
        return (0, access_1.requireBranchScope)(req, res, async () => {
            const sale = await prisma_1.prisma.sale.update({
                where: { id: existing.id },
                data: { amount: parsed.data.amount, paymentMethod: parsed.data.paymentMethod, cashierId: req.user.id }
            });
            res.json(sale);
        });
    }
    const sale = await prisma_1.prisma.sale.create({ data: { ...parsed.data, cashierId: req.user.id } });
    res.status(201).json(sale);
}
async function deleteSale(req, res) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.sale.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Sale not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        await prisma_1.prisma.sale.delete({ where: { id } });
        res.status(204).send();
    });
}
