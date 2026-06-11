import { Role } from "@prisma/client";
import { Router } from "express";
import { createShift, listShifts, updateShift } from "../controllers/shift.controller";
import { requireBranchScope, requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const shiftRouter = Router();
shiftRouter.use(authenticate);

shiftRouter.get("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.WAITER, Role.ADMIN), asyncHandler(listShifts));
shiftRouter.post("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.ADMIN), requireBranchScope, asyncHandler(createShift));
shiftRouter.put("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.ADMIN), asyncHandler(updateShift));
