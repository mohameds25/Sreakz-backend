import { Role } from "@prisma/client";
import { Router } from "express";
import { createInventoryItem, deleteInventoryItem, listInventory, refillInventoryItem, updateInventoryItem, useInventoryItem } from "../controllers/inventory.controller";
import { requireBranchScope, requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

inventoryRouter.get("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.ADMIN), asyncHandler(listInventory));
inventoryRouter.post("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.ADMIN), requireBranchScope, asyncHandler(createInventoryItem));
inventoryRouter.put("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.ADMIN), asyncHandler(updateInventoryItem));
inventoryRouter.put("/:id/use", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.ADMIN), asyncHandler(useInventoryItem));
inventoryRouter.put("/:id/refill", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.ADMIN), asyncHandler(refillInventoryItem));
inventoryRouter.delete("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.ADMIN), asyncHandler(deleteInventoryItem));
