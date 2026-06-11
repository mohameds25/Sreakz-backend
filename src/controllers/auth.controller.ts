import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

function createSession(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  branch?: { name: string } | null;
}) {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, branchId: user.branchId },
    env.jwtSecret,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branchName: user.role === Role.CUSTOMER ? "Customer Portal" : user.branch?.name ?? "UK Country Office"
    }
  };
}

export async function loginUser(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid login payload", issues: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, include: { branch: true } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json(createSession(user));
}

export async function registerCustomer(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid registration payload", issues: parsed.error.flatten() });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return res.status(409).json({ message: "Email is already registered" });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: Role.CUSTOMER
    },
    include: { branch: true }
  });

  return res.status(201).json(createSession(user));
}
