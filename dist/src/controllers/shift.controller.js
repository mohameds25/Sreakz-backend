"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listShifts = listShifts;
exports.createShift = createShift;
exports.updateShift = updateShift;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
const shiftSchema = zod_1.z.object({
    branchId: zod_1.z.string(),
    userId: zod_1.z.string(),
    startsAt: zod_1.z.coerce.date(),
    endsAt: zod_1.z.coerce.date(),
    status: zod_1.z.enum(["SCHEDULED", "ACTIVE", "COMPLETED"]).optional()
});
async function listShifts(req, res) {
    const branchId = (0, access_1.chooseScopedBranch)(req);
    const shifts = await prisma_1.prisma.shift.findMany({
        where: branchId ? { branchId } : undefined,
        include: { branch: true, user: { select: { id: true, name: true, role: true } } },
        orderBy: { startsAt: "asc" }
    });
    res.json(shifts);
}
async function createShift(req, res) {
    const parsed = shiftSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid shift payload", issues: parsed.error.flatten() });
    }
    const shift = await prisma_1.prisma.shift.create({ data: parsed.data });
    res.status(201).json(shift);
}
async function updateShift(req, res) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.shift.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Shift not found" });
    }
    req.body.branchId = req.body.branchId || existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const parsed = shiftSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: "Invalid shift payload", issues: parsed.error.flatten() });
        }
        const shift = await prisma_1.prisma.shift.update({ where: { id }, data: parsed.data });
        res.json(shift);
    });
}
