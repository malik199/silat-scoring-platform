"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sendVerificationEmail, reloadUser, signOut } from "@/lib/auth";

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [resent,    setResent]    = useState(false);
  const [checking,  setChecking]  = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // If no user at all, send to login
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // If user is already verified (e.g. social login ended up here), skip straight to dashboard
  useEffect(() => {
    if (!loading && user?.emailVerified) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleResend() {
    if (!user) return;
    setResending(true);
    setError(null);
    try {
      await sendVerificationEmail(user);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      setError("Could not resend email. Try again in a moment.");
    } finally {
      setResending(false);
    }
  }

  async function handleCheckVerified() {
    if (!user) return;
    setChecking(true);
    setError(null);
    try {
      await reloadUser(user);
      // After reload, auth state updates async — check directly on user object
      if (user.emailVerified) {
        router.replace("/dashboard");
      } else {
        setError("Email not verified yet. Check your inbox and click the link.");
      }
    } catch {
      setError("Could not check verification status. Try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <p className="text-secondary text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📬</span>
        </div>

        <h1 className="text-xl font-black text-primary mb-2">Check your inbox</h1>
        <p className="text-sm text-secondary mb-1">
          We sent a verification link to
        </p>
        <p className="text-sm font-semibold text-primary mb-8">
          {user.email}
        </p>

        {/* Actions */}
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 mb-6">
          <button
            type="button"
            onClick={handleCheckVerified}
            disabled={checking}
            className="w-full py-2.5 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {checking ? "Checking…" : "I've verified my email →"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resent}
            className="w-full py-2.5 rounded-lg border border-border text-secondary text-sm font-semibold hover:bg-elevated hover:text-primary disabled:opacity-50 transition-colors"
          >
            {resent ? "✓ Email sent!" : resending ? "Sending…" : "Resend verification email"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <p className="text-xs text-muted">
          Wrong account?{" "}
          <button
            type="button"
            onClick={handleSignOut}
            className="text-accent hover:underline"
          >
            Sign out
          </button>
          {" · "}
          <Link href="/" className="hover:text-secondary transition-colors">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
