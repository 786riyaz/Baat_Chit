"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "../../services/auth";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const data = await forgotPassword(email.trim());
      setMessage(data.message || "If that email is registered, a reset link has been sent.");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Reset your password</h1>
      <p className="subtitle">We&apos;ll email you a link to choose a new one.</p>
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/login">Back to login</Link>
        <span />
      </div>
    </div>
  );
}
