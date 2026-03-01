import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { NextResponse } from "next/server";

/**
 * Creates a Stripe Checkout Session for monthly subscription.
 * 1. Validates user session
 * 2. Creates or retrieves Stripe customer
 * 3. Returns checkout URL
 */
export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

    if (existingSubscription) {
        return NextResponse.json(
            { error: "You already have an active subscription" },
            { status: 400 }
        );
    }

    // Find or create Stripe customer
    let customerId: string;

    const { data: existingRecord } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (existingRecord?.stripe_customer_id) {
        customerId = existingRecord.stripe_customer_id;
    } else {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                supabase_user_id: user.id,
            },
        });
        customerId = customer.id;
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
            {
                price: process.env.STRIPE_PRICE_ID!, // Monthly subscription price
                quantity: 1,
            },
        ],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=cancelled`,
        metadata: {
            supabase_user_id: user.id,
        },
    });

    return NextResponse.json({ url: session.url });
}
