import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Fetch all levels ordered by position
    const { data: levels, error } = await supabase
        .from("levels")
        .select(
            `
      id,
      title,
      "order",
      modules (id)
    `
        )
        .order("order", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check subscription for access control
    let hasSubscription = false;
    if (user) {
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single();

        hasSubscription = !!subscription;
    }

    // Enrich levels with access info
    const enrichedLevels = levels?.map((level) => ({
        id: level.id,
        title: level.title,
        order: level.order,
        module_count: Array.isArray(level.modules) ? level.modules.length : 0,
        accessible: level.order === 0 || hasSubscription,
    }));

    return NextResponse.json({ levels: enrichedLevels });
}
