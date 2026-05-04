"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

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

// ─── Contact modal ────────────────────────────────────────────────────────────

function ContactModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", school: "", country: "",
    location: "", competitors: "", message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send.");
      setSent(true);
    } catch {
      setError("Something went wrong. Please try emailing us directly at silat.virginia@gmail.com");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-lg bg-base border border-border text-primary text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors";
  const labelCls = "block text-xs font-medium text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-primary">Contact for Pricing</h2>
            <p className="text-xs text-muted mt-0.5">We&apos;ll get back to you within 24 hours.</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary text-lg leading-none ml-4">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <span className="text-4xl">✅</span>
              <p className="text-sm font-bold text-primary">Message sent!</p>
              <p className="text-xs text-secondary">We&apos;ll be in touch at <span className="text-primary">{form.email}</span> shortly.</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Your Name <span className="text-danger">*</span></label>
                  <input type="text" required placeholder="Ahmad Razali" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email <span className="text-danger">*</span></label>
                  <input type="email" required placeholder="you@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>School / Organization <span className="text-danger">*</span></label>
                <input type="text" required placeholder="Pertubuhan Silat Kebangsaan..." value={form.school} onChange={(e) => set("school", e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Country <span className="text-danger">*</span></label>
                  <input type="text" required placeholder="Indonesia" value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>City / State <span className="text-danger">*</span></label>
                  <input type="text" required placeholder="Jakarta" value={form.location} onChange={(e) => set("location", e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Estimated number of competitors <span className="text-danger">*</span></label>
                <input type="number" required min={21} placeholder="e.g. 64" value={form.competitors} onChange={(e) => set("competitors", e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Additional information</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your event — tournament type, date, frequency, etc."
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {error && (
                <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-accent text-black text-sm font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {submitting ? "Sending…" : "Send Inquiry"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);

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
      <section className="max-w-5xl mx-auto px-6 pb-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Simple, transparent pricing</h2>
          <p className="text-secondary text-sm">Start free. Scale when you grow.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">

          {/* Free tier */}
          <div className="relative bg-surface rounded-2xl p-8 border border-accent/50 ring-1 ring-accent/10 flex flex-col">
            <div className="absolute -top-3.5 left-8 px-3 py-1 rounded-full bg-accent text-black text-xs font-black">
              Start here
            </div>
            <div className="mb-5 pt-1">
              <p className="text-xl font-black text-primary">Free</p>
              <p className="text-xs text-muted mt-0.5">Up to 20 competitors</p>
            </div>
            <div className="mb-6">
              <span className="text-5xl font-black text-accent">$0</span>
              <span className="text-xs text-muted ml-1">/ forever</span>
            </div>
            <ul className="space-y-2 mb-8 flex-1">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-secondary">
                  <span className="text-accent font-bold text-xs">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block w-full text-center py-3 rounded-xl bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Contact for pricing */}
          <div className="bg-surface rounded-2xl p-8 border border-border flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center text-2xl mb-5">
                🏆
              </div>
              <p className="text-xl font-black text-primary mb-2">More than 20 competitors?</p>
              <p className="text-sm text-secondary leading-relaxed mb-6">
                We offer custom plans for clubs, regional federations, and national championships.
                Tell us about your event and we&apos;ll find the right fit.
              </p>
              <ul className="space-y-2 mb-8">
                {["Unlimited competitors", "Priority support", "Custom setup assistance", "Volume pricing"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-secondary">
                    <span className="text-accent font-bold text-xs">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setContactOpen(true)}
              className="w-full py-3 rounded-xl border border-accent text-accent text-sm font-bold hover:bg-accent/5 transition-colors"
            >
              Contact for Pricing →
            </button>
          </div>
        </div>
      </section>

      {/* Contact modal */}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}

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
