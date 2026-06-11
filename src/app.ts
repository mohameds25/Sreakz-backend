import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import "./config/env";
import { authRouter } from "./routes/auth";
import { bookingRouter } from "./routes/bookings";
import { branchRouter } from "./routes/branches";
import { inventoryRouter } from "./routes/inventory";
import { orderRouter } from "./routes/orders";
import { reportRouter } from "./routes/reports";
import { saleRouter } from "./routes/sales";
import { shiftRouter } from "./routes/shifts";
import { userRouter } from "./routes/users";

export const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "Steakz MIS API" });
});

app.use("/api/auth", authRouter);
app.use("/api/branches", branchRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/users", userRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/orders", orderRouter);
app.use("/api/reports", reportRouter);
app.use("/api/sales", saleRouter);
app.use("/api/shifts", shiftRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({
    message: "Internal server error",
    detail: error instanceof Error ? error.message : "Unexpected server error"
  });
});
