import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getPricingTier } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    if (!stripeKey.startsWith("sk_live_") && !stripeKey.startsWith("sk_test_")) {
      return NextResponse.json({ error: `Bad key format: ${stripeKey.slice(0, 10)}...${stripeKey.slice(-4)}` }, { status: 500 });
    }

    // Verify caller is authenticated
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let organiserId: string;
    try {
      const decoded = await adminAuth().verifyIdToken(token);
      organiserId = decoded.uid;
    } catch (e) {
      console.error("verifyIdToken failed:", e);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tournamentId, tierId } = await req.json();
    if (!tournamentId || !tierId) {
      return NextResponse.json({ error: "tournamentId and tierId are required" }, { status: 400 });
    }

    const tier = getPricingTier(tierId);
    if (!tier || !tier.stripePriceId || tier.priceUsd === 0) {
      return NextResponse.json({ error: "Invalid or free tier" }, { status: 400 });
    }

    // Verify the tournament belongs to this organiser
    const tournamentDoc = await adminDb().collection("tournaments").doc(tournamentId).get();
    if (!tournamentDoc.exists || tournamentDoc.data()?.organiserId !== organiserId) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Use native fetch instead of Stripe SDK to avoid SDK connectivity issues
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]":    tier.stripePriceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/tournaments/${tournamentId}?payment=success`,
      cancel_url:  `${appUrl}/tournaments/${tournamentId}?payment=cancelled`,
      "metadata[tournamentId]": tournamentId,
      "metadata[tierId]":       tierId,
      "metadata[organiserId]":  organiserId,
      "payment_intent_data[description]": `Silat Score – ${tier.name} Package (up to ${tier.maxCompetitors} competitors)`,
      "payment_intent_data[metadata][tournamentId]": tournamentId,
      "payment_intent_data[metadata][tierId]":       tierId,
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const session = await stripeRes.json() as { url?: string; error?: { message: string } };

    if (!stripeRes.ok) {
      return NextResponse.json({ error: session.error?.message ?? "Stripe error" }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? `${e.message} [${(e as NodeJS.ErrnoException).code ?? "?"}]` : "Internal server error";
    console.error("create-checkout error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
