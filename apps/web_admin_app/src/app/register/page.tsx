"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerWithEmail, sendVerificationEmail } from "@/lib/auth";
import { createUserProfile } from "@/lib/users";
import { useAuth } from "@/context/AuthContext";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in and verified → skip to dashboard
  useEffect(() => {
    if (!loading && user?.emailVerified) router.replace("/dashboard");
    if (!loading && user && !user.emailVerified) router.replace("/verify-email");
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

    setSubmitting(true);
    try {
      const newUser = await registerWithEmail(email, password);
      await Promise.all([
        createUserProfile(newUser.uid, email),
        sendVerificationEmail(newUser),
      ]);
      router.replace("/verify-email");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <p className="text-secondary text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="text-center mb-6">
          <Link href="/" className="text-xl font-black text-primary tracking-tight">
            Silat Score
          </Link>
        </div>

        {/* Free tier badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Free — up to 20 competitors
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-7">
          <h2 className="text-base font-semibold text-primary mb-1">Create your account</h2>
          <p className="text-xs text-muted mb-5">No credit card required.</p>

          {/* Social buttons */}
          <SocialAuthButtons />

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@yourclub.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-elevated border border-border text-primary text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                className="w-full px-3.5 py-2.5 rounded-lg bg-elevated border border-border text-primary text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-elevated border border-border text-primary text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? "Creating account…" : "Create Free Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
