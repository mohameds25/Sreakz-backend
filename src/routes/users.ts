import { Role } from "@prisma/client";
import { Router } from "express";
import { createUser, deleteUser, listUsers, updateUser } from "../controllers/user.controller";
import { requireRoles } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { authenticate } from "../middleware/auth";

export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get("/", requireRoles(Role.ADMIN, Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER), asyncHandler(listUsers));
userRouter.post("/", requireRoles(Role.ADMIN, Role.HEADQUARTER_MANAGER, Role.BRANCH_MANAGER), asyncHandler(createUser));
userRouter.put("/:id", requireRoles(Role.ADMIN), asyncHandler(updateUser));
userRouter.delete("/:id", requireRoles(Role.ADMIN), asyncHandler(deleteUser));
