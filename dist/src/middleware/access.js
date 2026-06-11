"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = requireRoles;
exports.requireBranchScope = requireBranchScope;
exports.chooseScopedBranch = chooseScopedBranch;
const client_1 = require("@prisma/client");
const globalRoles = [client_1.Role.HEADQUARTER_MANAGER, client_1.Role.ADMIN];
function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden for this role" });
        }
        return next();
    };
}
function requireBranchScope(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: "Missing authenticated user" });
    }
    if (globalRoles.includes(req.user.role)) {
        return next();
    }
    const requestedBranchId = req.params.branchId || req.body.branchId || req.query.branchId;
    if (!requestedBranchId || requestedBranchId !== req.user.branchId) {
        return res.status(403).json({ message: "Branch users can only access their own branch" });
    }
    return next();
}
function chooseScopedBranch(req) {
    if (!req.user) {
        return undefined;
    }
    if (globalRoles.includes(req.user.role)) {
        return typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    }
    return req.user.branchId || undefined;
}
