"use client";

import AuthLayout from "../../components/common/AuthLayout";
import SignupForm from "../../components/auth/SignupForm";

export default function SignupPage() {
  return (
    <AuthLayout variant="signup">
      <SignupForm />
    </AuthLayout>
  );
}
