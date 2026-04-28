import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dealId, depositAmount, projectName, vendorName } = body;

    if (!dealId || !depositAmount || !projectName || !vendorName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey);

    const envKey = "NEXT_PUBLIC_APP_URL";
    const appUrl = process.env[envKey] || "https://www.pairascope.com";

    const amountInCents = Math.round(parseFloat(depositAmount) * 100);

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: projectName + " - Deposit to " + vendorName,
              description: "Project deposit via Pairascope. Deal ID: " + dealId,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: { dealId: dealId },
      after_completion: {
        type: "redirect",
        redirect: { url: appUrl + "/rfq-hub?payment=success" },
      },
    });

    const linkId = paymentLink["id"];
    const linkUrl = paymentLink.url;

    return NextResponse.json({ url: linkUrl, paymentLinkId: linkId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
