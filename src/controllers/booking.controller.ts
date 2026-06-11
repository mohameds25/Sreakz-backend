import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { chooseScopedBranch, requireBranchScope } from "../middleware/access";

const bookingSchema = z.object({
  branchId: z.string(),
  reservationAt: z.coerce.date(),
  guests: z.coerce.number().int().min(1).max(12),
  notes: z.string().optional()
});

function getListLimit(req: Request) {
  const rawLimit = Number(req.query.limit);
  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return undefined;
  }
  return Math.min(Math.trunc(rawLimit), 10);
}

function wantsSummary(req: Request) {
  return req.query.summary === "true";
}

function summarizeBookings(bookings: Array<{ customerName: string; reservationAt: Date; guests: number; status: string; branch: { name: string } }>) {
  return bookings.map((booking) => ({
    customer: booking.customerName,
    branch: booking.branch.name,
    date: booking.reservationAt.toISOString().slice(0, 10),
    persons: booking.guests,
    status: booking.status
  }));
}

export async function listBookings(req: Request, res: Response) {
  const take = getListLimit(req);
  if (req.user?.role === Role.CUSTOMER) {
    const bookings = await prisma.tableBooking.findMany({
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

  const branchId = chooseScopedBranch(req);
  const bookings = await prisma.tableBooking.findMany({
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

export async function createBooking(req: Request, res: Response) {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success || !req.user) {
    return res.status(400).json({ message: "Invalid booking payload", issues: parsed.success ? undefined : parsed.error.flatten() });
  }

  if (req.user.role !== Role.CUSTOMER) {
    return requireBranchScope(req, res, async () => {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
      const booking = await prisma.tableBooking.create({
        data: {
          ...parsed.data,
          customerId: req.user!.id,
          customerName: user?.name ?? req.user!.email
        },
        include: { branch: true }
      });
      res.status(201).json(booking);
    });
  }

  const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
  if (!branch) {
    return res.status(404).json({ message: "Branch not found" });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });

  const booking = await prisma.tableBooking.create({
    data: {
      ...parsed.data,
      customerId: req.user.id,
      customerName: user?.name ?? req.user.email
    },
    include: { branch: true }
  });
  res.status(201).json(booking);
}

export async function updateBookingStatus(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = z.object({ status: z.enum(["REQUESTED", "CONFIRMED", "CANCELLED"]) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid booking status", issues: parsed.error.flatten() });
  }

  const existing = await prisma.tableBooking.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Booking not found" });
  }

  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    const booking = await prisma.tableBooking.update({
      where: { id },
      data: parsed.data,
      include: { branch: true }
    });
    res.json(booking);
  });
}

export async function updateBooking(req: Request, res: Response) {
  const id = String(req.params.id);
  const parsed = bookingSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid booking payload", issues: parsed.error.flatten() });
  }
  const existing = await prisma.tableBooking.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Booking not found" });
  }
  req.body.branchId = parsed.data.branchId || existing.branchId;
  requireBranchScope(req, res, async () => {
    const booking = await prisma.tableBooking.update({
      where: { id },
      data: parsed.data,
      include: { branch: true }
    });
    res.json(booking);
  });
}

export async function deleteBooking(req: Request, res: Response) {
  const id = String(req.params.id);
  const existing = await prisma.tableBooking.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: "Booking not found" });
  }
  req.body.branchId = existing.branchId;
  requireBranchScope(req, res, async () => {
    await prisma.tableBooking.delete({ where: { id } });
    res.status(204).send();
  });
}
