"use client";

import { Suspense } from "react";
import AuthLayout from "../../components/common/AuthLayout";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout variant="reset-password">
      <Suspense fallback={<div className="page-loader">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
