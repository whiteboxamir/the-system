import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWeakAreas, getRequiredReviews } from "@/lib/weak-areas";

export async function GET() {
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

    const weakAreas = await getWeakAreas(supabase, user.id);
    const requiredReviews = await getRequiredReviews(supabase, user.id);

    return NextResponse.json({
        weak_areas: weakAreas,
        required_reviews: requiredReviews,
    });
}
