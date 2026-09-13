const nodemailer = require("nodemailer");

let cachedTransporter = null;

function isMailConfigured() {
return Boolean(
process.env.SMTP_HOST &&
process.env.SMTP_PORT &&
process.env.SMTP_USER &&
process.env.SMTP_PASS
);
}

function getTransporter() {
if (!isMailConfigured()) {
throw new Error(
"SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS."
);
}
if (cachedTransporter) return cachedTransporter;
cachedTransporter = nodemailer.createTransport({
host: process.env.SMTP_HOST,
port: Number(process.env.SMTP_PORT),
// true for port 465 (implicit TLS), false for 587/25 (STARTTLS)
secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
auth: {
user: process.env.SMTP_USER,
pass: process.env.SMTP_PASS
}
});
return cachedTransporter;
}

module.exports = { getTransporter, isMailConfigured };
