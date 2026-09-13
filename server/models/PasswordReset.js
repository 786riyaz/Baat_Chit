const mongoose = require("mongoose");

const passwordResetSchema = new mongoose.Schema(
{
user: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true,
index: true
},
// Only a SHA-256 hash of the reset token is ever stored - the raw token
// exists only in the email link, never in the database.
tokenHash: {
type: String,
required: true,
unique: true,
index: true
},
expiresAt: {
type: Date,
required: true
},
used: {
type: Boolean,
default: false
}
},
{ timestamps: true }
);

// MongoDB TTL index: documents are automatically deleted once expiresAt passes.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PasswordReset", passwordResetSchema);
