import { Role } from "@prisma/client";
import { Router } from "express";
import { branchReport, dashboardReport, inventoryReport, lowStockReport, salesReport } from "../controllers/report.controller";
import { requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const reportRouter = Router();
reportRouter.use(authenticate);
reportRouter.use(requireRoles(Role.ADMIN, Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER));

reportRouter.get("/dashboard", asyncHandler(dashboardReport));
reportRouter.get("/branches", asyncHandler(branchReport));
reportRouter.get("/sales", asyncHandler(salesReport));
reportRouter.get("/inventory", asyncHandler(inventoryReport));
reportRouter.get("/low-stock", asyncHandler(lowStockReport));
