const mongoose = require("mongoose");

const DEFAULT_TRIAL_LIMIT = Number(process.env.FREE_MESSAGE_LIMIT) || 10;

const userSchema = new mongoose.Schema(
{
name: {
type: String,
required: true,
trim: true
},
email: {
type: String,
required: true,
unique: true,
lowercase: true,
trim: true
},
phone: {
type: String,
required: true,
unique: true,
trim: true
},
password: {
type: String,
required: true
},

// ---- Exercise 20: profile management ----
profilePhoto: {
type: String,
default: null
},
bio: {
type: String,
default: "",
trim: true,
maxlength: 200
},
lastSeenPrivacy: {
type: String,
enum: ["everyone", "nobody"],
default: "everyone"
},

// ---- Exercise 21: online presence / last seen ----
isOnline: {
type: Boolean,
default: false
},
lastSeen: {
type: Date,
default: null
},

// ---- Exercise 19: approval / free-trial system ----
role: {
type: String,
enum: ["user", "admin"],
default: "user"
},
approvalStatus: {
type: String,
enum: ["pending", "approved", "rejected", "suspended"],
default: "pending"
},
trialMessageCount: {
type: Number,
default: 0,
min: 0
},
trialMessageLimit: {
type: Number,
default: DEFAULT_TRIAL_LIMIT,
min: 0
}
},
{ timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ approvalStatus: 1 });

module.exports = mongoose.model("User", userSchema);
