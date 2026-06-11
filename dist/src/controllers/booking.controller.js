"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBookings = listBookings;
exports.createBooking = createBooking;
exports.updateBookingStatus = updateBookingStatus;
exports.updateBooking = updateBooking;
exports.deleteBooking = deleteBooking;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const access_1 = require("../middleware/access");
const bookingSchema = zod_1.z.object({
    branchId: zod_1.z.string(),
    reservationAt: zod_1.z.coerce.date(),
    guests: zod_1.z.coerce.number().int().min(1).max(12),
    notes: zod_1.z.string().optional()
});
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
function summarizeBookings(bookings) {
    return bookings.map((booking) => ({
        customer: booking.customerName,
        branch: booking.branch.name,
        date: booking.reservationAt.toISOString().slice(0, 10),
        persons: booking.guests,
        status: booking.status
    }));
}
async function listBookings(req, res) {
    const take = getListLimit(req);
    if (req.user?.role === client_1.Role.CUSTOMER) {
        const bookings = await prisma_1.prisma.tableBooking.findMany({
            where: { customerId: req.user.id },
            include: { branch: true, customer: { select: { id: true, name: true, role: true } } },
            orderBy: { reservationAt: "desc" },
            take
        });
        if (wantsSummary(req)) {
            return res.json(summarizeBookings(bookings));
        }
        return res.json(bookings);
    }
    const branchId = (0, access_1.chooseScopedBranch)(req);
    const bookings = await prisma_1.prisma.tableBooking.findMany({
        where: branchId ? { branchId } : undefined,
        include: { branch: true, customer: { select: { id: true, name: true, role: true } } },
        orderBy: { reservationAt: "desc" },
        take
    });
    if (wantsSummary(req)) {
        return res.json(summarizeBookings(bookings));
    }
    res.json(bookings);
}
async function createBooking(req, res) {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success || !req.user) {
        return res.status(400).json({ message: "Invalid booking payload", issues: parsed.success ? undefined : parsed.error.flatten() });
    }
    if (req.user.role !== client_1.Role.CUSTOMER) {
        return (0, access_1.requireBranchScope)(req, res, async () => {
            const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
            const booking = await prisma_1.prisma.tableBooking.create({
                data: {
                    ...parsed.data,
                    customerId: req.user.id,
                    customerName: user?.name ?? req.user.email
                },
                include: { branch: true }
            });
            res.status(201).json(booking);
        });
    }
    const branch = await prisma_1.prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
    if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
    const booking = await prisma_1.prisma.tableBooking.create({
        data: {
            ...parsed.data,
            customerId: req.user.id,
            customerName: user?.name ?? req.user.email
        },
        include: { branch: true }
    });
    res.status(201).json(booking);
}
async function updateBookingStatus(req, res) {
    const id = String(req.params.id);
    const parsed = zod_1.z.object({ status: zod_1.z.enum(["REQUESTED", "CONFIRMED", "CANCELLED"]) }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid booking status", issues: parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.tableBooking.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const booking = await prisma_1.prisma.tableBooking.update({
            where: { id },
            data: parsed.data,
            include: { branch: true }
        });
        res.json(booking);
    });
}
async function updateBooking(req, res) {
    const id = String(req.params.id);
    const parsed = bookingSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Invalid booking payload", issues: parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.tableBooking.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
    }
    req.body.branchId = parsed.data.branchId || existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        const booking = await prisma_1.prisma.tableBooking.update({
            where: { id },
            data: parsed.data,
            include: { branch: true }
        });
        res.json(booking);
    });
}
async function deleteBooking(req, res) {
    const id = String(req.params.id);
    const existing = await prisma_1.prisma.tableBooking.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ message: "Booking not found" });
    }
    req.body.branchId = existing.branchId;
    (0, access_1.requireBranchScope)(req, res, async () => {
        await prisma_1.prisma.tableBooking.delete({ where: { id } });
        res.status(204).send();
    });
}
