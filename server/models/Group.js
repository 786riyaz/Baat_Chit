const mongoose = require("mongoose");
const groupSchema = new mongoose.Schema(
{
name: {
type: String,
required: true,
trim: true,
maxlength: 100
},
description: {
type: String,
default: "",
trim: true,
maxlength: 300
},
image: {
type: String,
default: null
},
roomId: {
type: String,
required: true,
unique: true,
index: true
},
createdBy: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true
},
// Group admins can manage members/settings. createdBy is always implicitly
// an admin (enforced in application code) even if removed from this array.
admins: [
{
type: mongoose.Schema.Types.ObjectId,
ref: "User"
}
],
members: [
{
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true
}
]
},
{ timestamps: true }
);
module.exports = mongoose.model("Group", groupSchema);
