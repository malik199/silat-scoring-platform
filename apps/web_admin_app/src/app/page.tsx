"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { TIERS } from "@/lib/tiers";

const FEATURES = [
  {
    icon: "⚖",
    label: "Real-Time Judge Scoring",
    desc: "Judges score from any phone. Points confirm automatically when 2+ judges agree within 5 seconds.",
  },
  {
    icon: "📺",
    label: "Broadcast Overlay",
    desc: "OBS-ready transparent lower-thirds with live scores, timer, and competitor names.",
  },
  {
    icon: "🏟",
    label: "Multi-Arena Control",
    desc: "Run multiple arenas simultaneously with independent Dewan panels, timers, and scoreboards.",
  },
];

const INCLUDED = [
  "Live judge scoring",
  "Multi-arena support",
  "Dewan control panel",
  "OBS broadcast overlay",
  "Verification system",
  "Violation tracking",
];

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-base text-primary">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-base/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/SilatScore.svg" alt="Silat Score" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-colors"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-secondary hover:text-primary transition-colors px-3 py-2">
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-colors"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Banner ── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,208,132,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {/* Subtle dot grid */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, opacity: 0.35,
            backgroundImage: "radial-gradient(circle, #3a3a3f 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            pointerEvents: "none",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
          {/* Logo in hero */}
          <div className="flex justify-center mb-8">
            <div
              style={{
                position: "relative",
                display: "inline-block",
              }}
            >
              {/* Glow ring behind logo */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "-24px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(0,208,132,0.15) 0%, transparent 70%)",
                  filter: "blur(16px)",
                }}
              />
              <img
                src="/logo.svg"
                alt="Silat Score"
                style={{ height: 180, width: "auto", position: "relative" }}
              />
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold mb-7 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Free for up to 20 competitors
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-[1.1] tracking-tight mb-5">
            Run Your Pencak Silat Tournament.
            <br />
            <span style={{ color: "#00d084" }}>Customized for Silat Tanding.</span>
          </h1>

          <p className="text-lg text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Real-time judge scoring, live broadcast overlays, and complete
            multi-arena control — built specifically for Pencak Silat Tanding competition.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto px-10 py-3.5 rounded-xl bg-accent text-black font-black text-sm hover:bg-accent-hover transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-10 py-3.5 rounded-xl border border-border text-secondary font-semibold text-sm hover:bg-elevated hover:text-primary transition-colors"
            >
              Sign In →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, label, desc }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-2xl p-7 hover:border-border/80 transition-colors"
            >
              <span className="text-3xl block mb-4">{icon}</span>
              <h3 className="text-sm font-bold text-primary mb-2">{label}</h3>
              <p className="text-xs text-secondary leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Simple, transparent pricing</h2>
          <p className="text-secondary text-sm">Start free. Upgrade as your tournaments grow.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {TIERS.map((tier) => {
            const isFree = tier.id === "free";
            return (
              <div
                key={tier.id}
                className={`relative bg-surface rounded-2xl p-6 border flex flex-col ${
                  isFree
                    ? "border-accent/50 ring-1 ring-accent/10"
                    : "border-border"
                }`}
              >
                {isFree && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-black text-xs font-black whitespace-nowrap">
                    Start here
                  </div>
                )}

                {/* Tier name + range */}
                <div className="mb-5 pt-1">
                  <p className="text-base font-black text-primary">{tier.name}</p>
                  <p className="text-xs text-muted mt-0.5">{tier.range}</p>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {isFree ? (
                    <div>
                      <span className="text-4xl font-black text-accent">$0</span>
                      <span className="text-xs text-muted ml-1">/ forever</span>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-muted italic">Pricing coming soon</p>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-secondary leading-relaxed mb-5 flex-1">
                  {tier.description}
                </p>

                {/* What's included — only show on free tier to keep cards compact */}
                {isFree && (
                  <ul className="space-y-1.5 mb-5">
                    {INCLUDED.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-secondary">
                        <span className="text-accent text-xs font-bold">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {/* CTA */}
                {isFree ? (
                  <Link
                    href="/register"
                    className="block w-full text-center py-2.5 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-colors"
                  >
                    Get started free
                  </Link>
                ) : (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg border border-border text-xs font-semibold text-muted cursor-not-allowed"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        <span>© {new Date().getFullYear()} Silat Score</span>
        <span className="mx-3 text-border">·</span>
        <Link href="/login" className="hover:text-secondary transition-colors">Sign In</Link>
        <span className="mx-3 text-border">·</span>
        <Link href="/register" className="hover:text-secondary transition-colors">Register</Link>
      </footer>
    </div>
  );
}
