"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/login", (0, asyncHandler_1.asyncHandler)(auth_controller_1.loginUser));
exports.authRouter.post("/register", (0, asyncHandler_1.asyncHandler)(auth_controller_1.registerCustomer));
