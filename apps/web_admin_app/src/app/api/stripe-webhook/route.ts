import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { getPricingTier } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // Idempotency: skip if already processed
  const eventRef = adminDb().collection("stripeEvents").doc(event.id);
  const existing = await eventRef.get();
  if (existing.exists) {
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { tournamentId, tierId } = session.metadata ?? {};

    if (tournamentId && tierId) {
      const tier = getPricingTier(tierId);
      await adminDb().collection("tournaments").doc(tournamentId).update({
        paymentStatus:      "paid",
        capacityTierId:     tierId,
        competitorCapacity: tier?.maxCompetitors ?? null,
        stripeSessionId:    session.id,
        paidAt:             new Date().toISOString(),
      });
    }
  }

  // Mark event processed
  await eventRef.set({ type: event.type, processedAt: new Date().toISOString() });

  return NextResponse.json({ received: true });
}
