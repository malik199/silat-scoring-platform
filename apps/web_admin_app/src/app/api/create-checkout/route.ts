import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getPricingTier } from "@/lib/pricing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    const stripe = new Stripe(stripeKey);
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: tier.stripePriceId, quantity: 1 }],
      success_url: `${appUrl}/tournaments/${tournamentId}?payment=success`,
      cancel_url:  `${appUrl}/tournaments/${tournamentId}?payment=cancelled`,
      metadata: { tournamentId, tierId, organiserId },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("create-checkout error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
