import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const DEALS_TABLE_ID = "tblDeals";

async function updateDealStage(dealId: string, stage: string) {
  const url = "https://api.airtable.com/v0/" + AIRTABLE_BASE_ID + "/" + DEALS_TABLE_ID + "/" + dealId;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + AIRTABLE_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        "Deal Stage": stage,
        "Deposit Received Date": new Date().toISOString().split("T")[0],
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("Airtable update failed: " + text);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecretKey = "STRIPE_WEBHOOK_SECRET";
  const webhookSecret = process.env[webhookSecretKey] || "";

  if (!stripeKey || !webhookSecret) {
    console.error("Stripe not configured");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature error:", message);
    return NextResponse.json({ error: "Webhook error: " + message }, { status: 400 });
  }

  const eventType = event["type"];
  if (eventType === "checkout.session.completed" || eventType === "payment_link.completed") {
    const eventData = event["data"];
    const session = eventData["object"] as Record<string, unknown>;
    const metadata = (session["metadata"] || {}) as Record<string, string>;
    const dealId = metadata["dealId"];

    if (dealId) {
      try {
        await updateDealStage(dealId, "Project Secured");
        console.log("Deal " + dealId + " updated to Project Secured");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to update deal:", message);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
