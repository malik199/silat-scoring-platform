"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user === null) {
      router.replace("/login");
    } else if (!user.emailVerified) {
      // Block unverified email/password accounts.
      // Social login users (Google, Facebook, Apple) are always verified by Firebase.
      router.replace("/verify-email");
    }
  }, [user, loading, router]);

  if (loading) return <p>Loading…</p>;
  if (user === null || !user.emailVerified) return null;

  return <>{children}</>;
}
