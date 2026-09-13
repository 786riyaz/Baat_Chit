"use client";

const COPY = {
  login: {
    headline: "Pick up right where you left off",
    body: "Your conversations, your groups, and your people - all waiting."
  },
  signup: {
    headline: "Every conversation starts somewhere",
    body: "Create an account and start chatting immediately on a free trial."
  },
  "forgot-password": {
    headline: "Locked out happens to everyone",
    body: "We'll send a link to get you back into your conversations."
  },
  "reset-password": {
    headline: "Almost back in",
    body: "Choose a new password and you're back to your conversations."
  }
};

export default function AuthLayout({ variant, children }) {
  const copy = COPY[variant] || COPY.login;
  return (
    <div className="auth-layout">
      <div className="auth-brand-pane">
        <h1>{copy.headline}</h1>
        <p>{copy.body}</p>
        <div className="auth-brand-bubbles" aria-hidden="true">
          <div className="ghost-bubble">Hey, are we still on for tomorrow?</div>
          <div className="ghost-bubble mine">Yep, 4pm works for me</div>
          <div className="ghost-bubble">Perfect, see you then</div>
        </div>
      </div>
      <div className="auth-form-pane">{children}</div>
    </div>
  );
}
