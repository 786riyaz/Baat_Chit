const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema(
{
chatType: {
type: String,
enum: ["personal", "group"],
required: true
},
roomId: {
type: String,
required: true,
index: true
},
groupId: {
type: mongoose.Schema.Types.ObjectId,
ref: "Group",
default: null
},
sender: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true
},
text: {
type: String,
default: "",
trim: true,
maxlength: 2000
},
media: {
key: { type: String, default: null },
url: { type: String, default: null },
originalName: { type: String, default: null },
mimeType: { type: String, default: null },
size: { type: Number, default: null }
},
// ---- Exercise 22: delivery / read receipts ----
// Kept as simple membership arrays rather than per-user timestamped
// records - this scales fine at group sizes a chat app like this expects,
// and lets personal and group chats share one schema/status model.
deliveredTo: [
{
type: mongoose.Schema.Types.ObjectId,
ref: "User"
}
],
readBy: [
{
type: mongoose.Schema.Types.ObjectId,
ref: "User"
}
]
},
{
timestamps: true,
toJSON: { virtuals: true },
toObject: { virtuals: true }
}
);
messageSchema.index({ roomId: 1, createdAt: 1 });
// sent -> delivered -> read, derived from the arrays above so there is a
// single source of truth instead of a separately-maintained status field.
messageSchema.virtual("status").get(function status() {
if (this.readBy && this.readBy.length > 0) return "read";
if (this.deliveredTo && this.deliveredTo.length > 0) return "delivered";
return "sent";
});
module.exports = mongoose.model("Message", messageSchema);
