"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
const userSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.nativeEnum(client_1.Role),
    branchId: zod_1.z.string().nullable().optional()
});
function getListLimit(req) {
    const rawLimit = Number(req.query.limit);
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
        return undefined;
    }
    return Math.min(Math.trunc(rawLimit), 10);
}
async function listUsers(req, res) {
    const branchId = (0, access_1.chooseScopedBranch)(req);
    const users = await prisma_1.prisma.user.findMany({
        where: branchId ? { branchId } : undefined,
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true, branchId: true, createdAt: true, branch: true },
        take: getListLimit(req)
    });
    if (req.query.summary === "true") {
        return res.json(users.map((user) => ({
            name: user.name,
            email: user.email,
            role: user.role,
            branch: user.branch?.name ?? "Global"
        })));
    }
    res.json(users);
}
async function createUser(req, res) {
    const parsed = userSchema.safeParse(req.body);
    if (!req.user) {
        return res.status(401).json({ message: "Missing authenticated user" });
    }
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid user payload", issues: parsed.error.flatten() });
    }
    const userData = { ...parsed.data };
    if (req.user.role === client_1.Role.BRANCH_MANAGER) {
        const allowedBranchRoles = [client_1.Role.CHEF, client_1.Role.WAITER];
        if (!allowedBranchRoles.includes(userData.role)) {
            return res.status(403).json({ message: "Branch managers can only create chefs and waiters" });
        }
        userData.branchId = req.user.branchId;
    }
    if (req.user.role === client_1.Role.HEADQUARTER_MANAGER) {
        const allowedHeadquarterRoles = [client_1.Role.BRANCH_MANAGER, client_1.Role.CHEF, client_1.Role.WAITER, client_1.Role.CASHIER];
        if (!allowedHeadquarterRoles.includes(userData.role)) {
            return res.status(403).json({ message: "Headquarter can create branch staff only" });
        }
        if (!userData.branchId) {
            return res.status(400).json({ message: "Choose a branch for this staff account" });
        }
    }
    const { password, ...createData } = userData;
    const user = await prisma_1.prisma.user.create({
        data: { ...createData, passwordHash: await bcryptjs_1.default.hash(password, 10) },
        select: { id: true, name: true, email: true, role: true, branchId: true, branch: true }
    });
    res.status(201).json(user);
}
async function updateUser(req, res) {
    const id = String(req.params.id);
    const parsed = userSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid user payload", issues: parsed.error.flatten() });
    }
    const { password, ...rest } = parsed.data;
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data: { ...rest, ...(password ? { passwordHash: await bcryptjs_1.default.hash(password, 10) } : {}) },
        select: { id: true, name: true, email: true, role: true, branchId: true }
    });
    res.json(user);
}
async function deleteUser(req, res) {
    const id = String(req.params.id);
    await prisma_1.prisma.user.delete({ where: { id } });
    res.status(204).send();
}
