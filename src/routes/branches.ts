import { Role } from "@prisma/client";
import { Router } from "express";
import { createBranch, deleteBranch, listBranches, updateBranch } from "../controllers/branch.controller";
import { requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const branchRouter = Router();
branchRouter.use(authenticate);

branchRouter.get("/", asyncHandler(listBranches));
branchRouter.post("/", requireRoles(Role.ADMIN, Role.HEADQUARTER_MANAGER), asyncHandler(createBranch));
branchRouter.put("/:id", requireRoles(Role.ADMIN, Role.HEADQUARTER_MANAGER), asyncHandler(updateBranch));
branchRouter.delete("/:id", requireRoles(Role.ADMIN, Role.HEADQUARTER_MANAGER), asyncHandler(deleteBranch));
