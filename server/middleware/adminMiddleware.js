const User = require("../models/User");
const { ensureAdminRoleSynced } = require("../services/approvalService");

// Runs after authenticateToken. Never trusts a role claim from the JWT/frontend;
// always re-checks the current role in the database, and self-heals it if
// ADMIN_EMAIL was set/changed after this account already existed.
async function requireAdmin(req, res, next) {
try {
const user = await User.findById(req.user.userId);
if (!user) {
return res.status(403).json({
success: false,
message: "Admin access required"
});
}
await ensureAdminRoleSynced(user);
if (user.role !== "admin") {
return res.status(403).json({
success: false,
message: "Admin access required"
});
}
req.adminUser = user;
next();
} catch (error) {
console.error("Admin middleware error:", error);
return res.status(500).json({
success: false,
message: "Internal server error"
});
}
}

module.exports = requireAdmin;
