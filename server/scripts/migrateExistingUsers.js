/**
 * One-off migration for Exercise 19.
 *
 * Run this ONCE, right after deploying the new User schema, against any
 * database that already had users before the approval/trial system existed.
 *
 * Why it's needed: the new schema defaults every user to
 * approvalStatus="pending". Without this script, everyone who signed up
 * before this change would suddenly be treated as an unapproved trial user
 * and could lose access - which violates "preserve existing functionality".
 *
 * What it does:
 * - If a user's email matches ADMIN_EMAIL -> role="admin", approvalStatus="approved".
 * - Every other pre-existing user is grandfathered in as approvalStatus="approved"
 *   (full access, no trial limit applied retroactively).
 * - Fills in trialMessageCount/trialMessageLimit if missing.
 *
 * Usage:
 *   npm run migrate:approval
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { resolveSignupStatus, getTrialLimit } = require("../services/approvalService");

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB. Starting migration...");

  const users = await User.find({});
  let adminCount = 0;
  let grandfatheredCount = 0;

  for (const user of users) {
    const { role } = resolveSignupStatus(user.email);
    user.role = role;
    user.approvalStatus = "approved"; // grandfather clause - see header comment
    if (typeof user.trialMessageCount !== "number") user.trialMessageCount = 0;
    if (!user.trialMessageLimit) user.trialMessageLimit = getTrialLimit();
    await user.save();
    if (role === "admin") adminCount += 1;
    else grandfatheredCount += 1;
  }

  console.log(`Migration complete.`);
  console.log(`  Admin users:          ${adminCount}`);
  console.log(`  Grandfathered users:  ${grandfatheredCount}`);
  console.log(`  Total users updated:  ${users.length}`);

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
