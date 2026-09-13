const User = require("../models/User");

// Runs after authenticateToken. Never trusts a role claim from the JWT/frontend;
// always re-checks the current role in the database.
async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select("role");
    if (!user || user.role !== "admin") {
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
