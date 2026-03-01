import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get("level_id");

    if (!levelId) {
        return NextResponse.json(
            { error: "level_id is required" },
            { status: 400 }
        );
    }

    // Verify level access
    const { data: level } = await supabase
        .from("levels")
        .select("id, \"order\"")
        .eq("id", levelId)
        .single();

    if (!level) {
        return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }

    // Check subscription for Level 1+
    if (level.order > 0) {
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status")
            .eq("user_id", user.id)
            .eq("status", "active")
            .single();

        if (!subscription) {
            return NextResponse.json(
                { error: "Active subscription required for this level" },
                { status: 403 }
            );
        }
    }

    // Fetch modules for this level
    const { data: modules, error } = await supabase
        .from("modules")
        .select(
            `
      id,
      title,
      "order",
      lessons (id)
    `
        )
        .eq("level_id", levelId)
        .order("order", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enrichedModules = modules?.map((mod) => ({
        id: mod.id,
        title: mod.title,
        order: mod.order,
        lesson_count: Array.isArray(mod.lessons) ? mod.lessons.length : 0,
    }));

    return NextResponse.json({ modules: enrichedModules });
}
