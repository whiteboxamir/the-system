import { stripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * Stripe webhook handler.
 * Handles subscription lifecycle events:
 * - checkout.session.completed → create subscription record
 * - customer.subscription.updated → update status + period end
 * - customer.subscription.deleted → mark subscription inactive
 */
export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "Missing stripe-signature header" },
            { status: 400 }
        );
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Webhook signature verification failed:", message);
        return NextResponse.json(
            { error: `Webhook Error: ${message}` },
            { status: 400 }
        );
    }

    // Use service role client to bypass RLS
    const supabase = createServiceClient();

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.supabase_user_id;
            const subscriptionId = session.subscription as string;
            const customerId = session.customer as string;

            if (!userId || !subscriptionId) {
                console.error("Missing metadata in checkout session");
                break;
            }

            // Fetch the subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            await supabase.from("subscriptions").upsert(
                {
                    user_id: userId,
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscriptionId,
                    status: subscription.status as string,
                    current_period_end: new Date(
                        subscription.current_period_end * 1000
                    ).toISOString(),
                },
                {
                    onConflict: "stripe_subscription_id",
                }
            );

            break;
        }

        case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;

            await supabase
                .from("subscriptions")
                .update({
                    status: subscription.status as string,
                    current_period_end: new Date(
                        subscription.current_period_end * 1000
                    ).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("stripe_subscription_id", subscription.id);

            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;

            await supabase
                .from("subscriptions")
                .update({
                    status: "canceled",
                    updated_at: new Date().toISOString(),
                })
                .eq("stripe_subscription_id", subscription.id);

            break;
        }

        default:
            // Unhandled event type — log but don't error
            console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
}
