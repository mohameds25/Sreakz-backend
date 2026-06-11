"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
require("./config/env");
const auth_1 = require("./routes/auth");
const bookings_1 = require("./routes/bookings");
const branches_1 = require("./routes/branches");
const inventory_1 = require("./routes/inventory");
const orders_1 = require("./routes/orders");
const reports_1 = require("./routes/reports");
const sales_1 = require("./routes/sales");
const shifts_1 = require("./routes/shifts");
const users_1 = require("./routes/users");
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({ origin: true }));
exports.app.use(express_1.default.json());
exports.app.use((0, morgan_1.default)("dev"));
exports.app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "Steakz MIS API" });
});
exports.app.use("/api/auth", auth_1.authRouter);
exports.app.use("/api/branches", branches_1.branchRouter);
exports.app.use("/api/bookings", bookings_1.bookingRouter);
exports.app.use("/api/users", users_1.userRouter);
exports.app.use("/api/inventory", inventory_1.inventoryRouter);
exports.app.use("/api/orders", orders_1.orderRouter);
exports.app.use("/api/reports", reports_1.reportRouter);
exports.app.use("/api/sales", sales_1.saleRouter);
exports.app.use("/api/shifts", shifts_1.shiftRouter);
exports.app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
});
exports.app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({
        message: "Internal server error",
        detail: error instanceof Error ? error.message : "Unexpected server error"
    });
});
