"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBranches = listBranches;
exports.createBranch = createBranch;
exports.updateBranch = updateBranch;
exports.deleteBranch = deleteBranch;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const branchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    city: zod_1.z.string().min(2),
    address: zod_1.z.string().min(5),
    phone: zod_1.z.string().min(5)
});
async function listBranches(_req, res) {
    const branches = await prisma_1.prisma.branch.findMany({ orderBy: { name: "asc" } });
    res.json(branches);
}
async function createBranch(req, res) {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid branch payload", issues: parsed.error.flatten() });
    }
    const passwordHash = await bcryptjs_1.default.hash("123456", 10);
    const key = parsed.data.city.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "") || `branch.${Date.now()}`;
    const branch = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.branch.create({ data: parsed.data });
        await tx.user.createMany({
            data: [
                { name: `${parsed.data.city} Branch Manager`, email: `manager.${key}@steakz.test`, passwordHash, role: client_1.Role.BRANCH_MANAGER, branchId: created.id },
                { name: `${parsed.data.city} Chef`, email: `chef.${key}@steakz.test`, passwordHash, role: client_1.Role.CHEF, branchId: created.id },
                { name: `${parsed.data.city} Waiter`, email: `waiter.${key}@steakz.test`, passwordHash, role: client_1.Role.WAITER, branchId: created.id },
                { name: `${parsed.data.city} Cashier`, email: `cashier.${key}@steakz.test`, passwordHash, role: client_1.Role.CASHIER, branchId: created.id }
            ],
            skipDuplicates: true
        });
        return created;
    });
    res.status(201).json(branch);
}
async function updateBranch(req, res) {
    const id = String(req.params.id);
    const parsed = branchSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid branch payload", issues: parsed.error.flatten() });
    }
    const branch = await prisma_1.prisma.branch.update({ where: { id }, data: parsed.data });
    res.json(branch);
}
async function deleteBranch(req, res) {
    const id = String(req.params.id);
    await prisma_1.prisma.user.updateMany({ where: { branchId: id }, data: { branchId: null } });
    await prisma_1.prisma.branch.delete({ where: { id } });
    res.status(204).send();
}
