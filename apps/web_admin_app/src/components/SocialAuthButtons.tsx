"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, signInWithFacebook, signInWithApple } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/users";

type Provider = "google" | "facebook" | "apple";

const PROVIDERS: { id: Provider; label: string; bg: string; fg: string; border: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    label: "Continue with Google",
    bg: "#ffffff",
    fg: "#1f1f1f",
    border: "#dadce0",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
        <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
        <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"/>
        <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Continue with Facebook",
    bg: "#1877F2",
    fg: "#ffffff",
    border: "#1877F2",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Continue with Apple",
    bg: "#000000",
    fg: "#ffffff",
    border: "#000000",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" aria-hidden>
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
      </svg>
    ),
  },
];

export function SocialAuthButtons() {
  const router = useRouter();
  const [busy,  setBusy]  = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProvider(id: Provider) {
    setBusy(id);
    setError(null);
    try {
      const fn = id === "google" ? signInWithGoogle
               : id === "facebook" ? signInWithFacebook
               : signInWithApple;
      const { user } = await fn();
      // Always ensure profile exists (idempotent for returning users)
      await ensureUserProfile(user.uid, user.email ?? "");
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      // Surface friendly messages for common errors
      if (msg.includes("popup-closed")) {
        setError("Sign-in cancelled.");
      } else if (msg.includes("account-exists")) {
        setError("An account with this email already exists. Try signing in with email and password.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {PROVIDERS.map(({ id, label, bg, fg, border, icon }) => (
        <button
          key={id}
          type="button"
          disabled={!!busy}
          onClick={() => handleProvider(id)}
          style={{ background: bg, color: fg, borderColor: border }}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === id ? (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            icon
          )}
          {label}
        </button>
      ))}
      {error && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
