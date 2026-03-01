import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    // Fetch subscription status
    const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email,
        },
        subscription: subscription ?? null,
    });
}
