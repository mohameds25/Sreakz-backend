import { Role } from "@prisma/client";
import { Router } from "express";
import { createOrder, deleteOrder, getOrder, listOrders, updateOrder, updateOrderStatus } from "../controllers/order.controller";
import { requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const orderRouter = Router();
orderRouter.use(authenticate);

orderRouter.get("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.WAITER, Role.CASHIER, Role.ADMIN, Role.CUSTOMER), asyncHandler(listOrders));
orderRouter.get("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.WAITER, Role.CASHIER, Role.ADMIN, Role.CUSTOMER), asyncHandler(getOrder));
orderRouter.post("/", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.CASHIER, Role.ADMIN, Role.CUSTOMER), asyncHandler(createOrder));
orderRouter.put("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.WAITER, Role.CASHIER, Role.ADMIN), asyncHandler(updateOrder));
orderRouter.put("/:id/status", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.CHEF, Role.WAITER, Role.CASHIER, Role.ADMIN), asyncHandler(updateOrderStatus));
orderRouter.delete("/:id", requireRoles(Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER, Role.ADMIN), asyncHandler(deleteOrder));
