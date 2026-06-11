import { Router } from "express";
import { loginUser, registerCustomer } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginUser));
authRouter.post("/register", asyncHandler(registerCustomer));
