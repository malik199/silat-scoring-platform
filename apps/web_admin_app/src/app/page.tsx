"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { PRICING_TIERS } from "@/lib/pricing";

const FEATURES = [
  {
    image: "/scoreimage1.jpg",
    icon: "⚖",
    label: "Real-Time Judge Scoring",
    desc: "Judges score from any phone. Points confirm automatically when 2+ judges agree within 5 seconds.",
  },
  {
    image: "/scoreimage2.jpg",
    icon: "📱",
    label: "Companion Mobile App",
    desc: "Judges score wirelessly over WiFi using our companion app, available on iOS and Android.",
  },
  {
    image: "/scoreimage3.jpg",
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

const PHOTOS = [
  "PXL_20260725_165817652.jpg",
  "PXL_20260725_165822480.jpg",
  "PXL_20260725_174959272.jpg",
  "PXL_20260725_213201410.jpg",
  "PXL_20260725_213208259.jpg",
  "PXL_20260926_174009149.jpg",
  "PXL_20260926_174016730.jpg",
  "PXL_20260926_174047061.jpg",
  "PXL_20260926_174050199.jpg",
  "PXL_20260926_174052961.jpg",
  "PXL_20260926_174104971.jpg",
  "PXL_20260926_174111373.jpg",
  "PXL_20260926_180525747.jpg",
  "PXL_20260926_181606659.jpg",
  "PXL_20260926_181617669.jpg",
  "PXL_20260926_183855325.jpg",
  "PXL_20260926_190606014.jpg",
  "PXL_20260926_193454366.jpg",
  "PXL_20260926_193457831.jpg",
  "PXL_20260926_210841335.jpg",
  "PXL_20260926_174329946.jpg",
  "WhatsApp Image 2026-08-08 at 09.32.37.jpeg",
  "WhatsApp Image 2026-08-08 at 09.32.52.jpeg",
  "WhatsApp Image 2026-08-08 at 09.32.54.jpeg",
];

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ photos, index, onClose }: { photos: string[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);

  const prev = useCallback(() => setCurrent((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setCurrent((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape")     onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors">
        ‹
      </button>
      <img
        src={`/photos/${encodeURIComponent(photos[current])}`}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
      />
      <button onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors">
        ›
      </button>
      <button onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
        ✕
      </button>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50">
        {current + 1} / {photos.length}
      </p>
    </div>
  );
}

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
                  <input type="text" required placeholder="Full Name" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
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
  const [contactOpen,  setContactOpen]  = useState(false);
  const [lightboxIdx,  setLightboxIdx]  = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-base text-primary" style={{ scrollBehavior: "smooth" }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-base/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/SilatScore.svg" alt="Silat Score" className="h-8 w-auto" />
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-5">
              <a href="#about"   className="text-sm text-secondary hover:text-primary transition-colors">About</a>
              <a href="#gallery" className="text-sm text-secondary hover:text-primary transition-colors">Gallery</a>
              <a href="#pricing" className="text-sm text-secondary hover:text-primary transition-colors">Pricing</a>
            </div>
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
            Free for up to 10 competitors
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

      {/* ── Video ── */}
      <section id="about" className="max-w-4xl mx-auto px-6 pb-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Modern tournaments. Made simple.</h2>
          <p className="text-secondary max-w-2xl mx-auto leading-relaxed text-sm">
            Running a Pencak Silat tournament just got a whole lot easier. Real-time scoring, live overlays,
            bracket management, and multi-arena control — battle-tested at large tournaments and free to start.
          </p>
        </div>
        <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-2xl" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src="https://www.youtube.com/embed/CmNySfGCJXY"
            title="Silat Score in action"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ image, icon, label, desc }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-border/80 transition-colors"
            >
              <div className="w-full h-44 overflow-hidden">
                <img
                  src={image}
                  alt={label}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <span className="text-2xl block mb-2">{icon}</span>
                <h3 className="text-sm font-bold text-primary mb-2">{label}</h3>
                <p className="text-xs text-secondary leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Photo Gallery ── */}
      <section id="gallery" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black mb-2">See it in action</h2>
          <p className="text-secondary text-sm">Real tournaments powered by Silat Score</p>
        </div>
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
          {PHOTOS.map((photo, i) => (
            <div
              key={photo}
              className="mb-3 break-inside-avoid cursor-pointer group relative overflow-hidden rounded-xl"
              onClick={() => setLightboxIdx(i)}
            >
              <img
                src={`/photos/${encodeURIComponent(photo)}`}
                alt="Tournament photo"
                loading="lazy"
                className="w-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Simple, transparent pricing</h2>
          <p className="text-secondary text-sm">One-time payment per tournament. No subscriptions.</p>
        </div>

        {/* Free tier — full-width compact banner */}
        <div className="relative bg-surface border border-accent/50 ring-1 ring-accent/10 rounded-2xl px-8 py-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="absolute -top-3.5 left-8 px-3 py-1 rounded-full bg-accent text-black text-xs font-black">
            Start here
          </div>
          <div className="flex-1 pt-1">
            <p className="text-xl font-black text-primary mb-0.5">Free</p>
            <p className="text-sm text-secondary">Up to 10 competitors · All features included · No credit card required</p>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div>
              <span className="text-4xl font-black text-accent">$0</span>
              <span className="text-xs text-muted ml-1">/ forever</span>
            </div>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-xl bg-accent text-black text-sm font-bold hover:bg-accent-hover transition-colors whitespace-nowrap"
            >
              Get started free
            </Link>
          </div>
        </div>

        {/* Paid tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PRICING_TIERS.filter((t) => t.priceUsd > 0).map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-surface rounded-2xl p-6 border flex flex-col ${
                tier.popular
                  ? "border-accent/50 ring-1 ring-accent/10"
                  : "border-border"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-5 px-2.5 py-1 rounded-full bg-accent text-black text-xs font-black">
                  Most popular
                </div>
              )}
              <div className="mb-4 pt-1">
                <p className="font-black text-primary text-base">{tier.name}</p>
                <p className="text-xs text-muted mt-0.5">Up to {tier.maxCompetitors} competitors</p>
              </div>
              <div className="mb-3">
                <span className="text-3xl font-black text-primary">${tier.priceUsd}</span>
                <span className="text-xs text-muted ml-1">/ tournament</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed mb-6 flex-1">{tier.description}</p>
              <Link
                href="/register"
                className={`block text-center py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  tier.popular
                    ? "bg-accent text-black hover:bg-accent-hover"
                    : "border border-border text-secondary hover:text-primary hover:border-primary/40"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Need a custom plan for a national federation or recurring events?{" "}
          <button onClick={() => setContactOpen(true)} className="text-accent hover:underline">
            Contact us →
          </button>
        </p>
      </section>

      {/* Contact modal */}
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox photos={PHOTOS} index={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

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
