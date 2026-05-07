import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia"
    })
  : null;

export async function createDiscoveryCheckout(candidateId: string) {
  if (!stripe || !process.env.STRIPE_DISCOVERY_PRICE_ID) {
    return { url: "/candidat/dashboard?mockStripe=1" };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: process.env.STRIPE_DISCOVERY_PRICE_ID,
        quantity: 1
      }
    ],
    metadata: {
      candidateId,
      stepNumber: "4"
    },
    success_url: `${process.env.NEXTAUTH_URL}/candidat/etape/4?success=1`,
    cancel_url: `${process.env.NEXTAUTH_URL}/candidat/etape/4?canceled=1`
  });

  return { url: session.url };
}
