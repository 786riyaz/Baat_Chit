const { getTransporter } = require("../config/mail");

function escapeHtml(value) {
return String(value || "").replace(/[&<>"']/g, (char) => (
{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiryMinutes }) {
const transporter = getTransporter();
const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
const safeName = escapeHtml(name || "there");

const text = [
`Hi ${name || "there"},`,
"",
"We received a request to reset your password.",
`This link is valid for ${expiryMinutes} minutes:`,
resetUrl,
"",
"If you did not request this, you can safely ignore this email - your password will not be changed."
].join("\n");

const html = `
<p>Hi ${safeName},</p>
<p>We received a request to reset your password. This link is valid for ${expiryMinutes} minutes:</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, you can safely ignore this email - your password will not be changed.</p>
`.trim();

return transporter.sendMail({
from,
to,
subject: "Reset your password",
text,
html
});
}

module.exports = { sendPasswordResetEmail };
