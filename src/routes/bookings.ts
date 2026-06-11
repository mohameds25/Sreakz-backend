import { Role } from "@prisma/client";
import { Router } from "express";
import { createBooking, deleteBooking, listBookings, updateBooking, updateBookingStatus } from "../controllers/booking.controller";
import { requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const bookingRouter = Router();
bookingRouter.use(authenticate);

bookingRouter.get("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.ADMIN, Role.CUSTOMER), asyncHandler(listBookings));
bookingRouter.post("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.ADMIN, Role.CUSTOMER), asyncHandler(createBooking));
bookingRouter.put("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.ADMIN), asyncHandler(updateBooking));
bookingRouter.put("/:id/status", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.ADMIN), asyncHandler(updateBookingStatus));
bookingRouter.delete("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.ADMIN), asyncHandler(deleteBooking));
