"use client";

import { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user?.emailVerified) router.replace("/dashboard");
    if (!loading && user && !user.emailVerified) router.replace("/verify-email");
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await signInWithEmail(email, password);
      if (!signedIn.emailVerified) {
        router.replace("/verify-email");
      } else {
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Check your credentials.");
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

        {/* Wordmark */}
        <div className="text-center mb-8">
          <Link href="/">
            <img src="/SilatScore.svg" alt="Silat Score" className="h-10 w-auto mx-auto" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-7">
          <h2 className="text-base font-semibold text-primary mb-5">Sign in</h2>

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
                placeholder="admin@example.com"
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
                autoComplete="current-password"
                placeholder="••••••••"
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
              className="w-full py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent hover:underline">Register free</Link>
        </p>
      </div>
    </div>
  );
}
