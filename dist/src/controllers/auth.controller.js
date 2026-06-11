"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = loginUser;
exports.registerCustomer = registerCustomer;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
function createSession(user) {
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, branchId: user.branchId }, env_1.env.jwtSecret, { expiresIn: "8h" });
    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            branchId: user.branchId,
            branchName: user.role === client_1.Role.CUSTOMER ? "Customer Portal" : user.branch?.name ?? "UK Country Office"
        }
    };
}
async function loginUser(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid login payload", issues: parsed.error.flatten() });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { email: parsed.data.email }, include: { branch: true } });
    if (!user || !(await bcryptjs_1.default.compare(parsed.data.password, user.passwordHash))) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    return res.json(createSession(user));
}
async function registerCustomer(req, res) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid registration payload", issues: parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
        return res.status(409).json({ message: "Email is already registered" });
    }
    const user = await prisma_1.prisma.user.create({
        data: {
            name: parsed.data.name,
            email: parsed.data.email,
            passwordHash: await bcryptjs_1.default.hash(parsed.data.password, 10),
            role: client_1.Role.CUSTOMER
        },
        include: { branch: true }
    });
    return res.status(201).json(createSession(user));
}
