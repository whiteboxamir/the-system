import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET: Returns user's progress across all lessons.
 * POST: Updates lesson completion status.
 */
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

    // Fetch all progress records for this user
    const { data: progress, error } = await supabase
        .from("progress")
        .select(
            `
      id,
      lesson_id,
      completed,
      last_score,
      updated_at,
      lessons!inner (
        id,
        title,
        "order",
        module_id,
        modules!inner (
          id,
          title,
          "order",
          level_id,
          levels!inner (
            id,
            title,
            "order"
          )
        )
      )
    `
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate overall stats
    const { count: totalLessons } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true });

    const completedLessons = progress?.filter((p) => p.completed).length ?? 0;
    const progressPercentage =
        totalLessons && totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

    return NextResponse.json({
        progress: progress ?? [],
        stats: {
            total_lessons: totalLessons ?? 0,
            completed_lessons: completedLessons,
            progress_percentage: progressPercentage,
        },
    });
}

export async function POST(request: NextRequest) {
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

    const { lesson_id, completed, last_score } = await request.json();

    if (!lesson_id) {
        return NextResponse.json(
            { error: "lesson_id is required" },
            { status: 400 }
        );
    }

    const { error } = await supabase.from("progress").upsert(
        {
            user_id: user.id,
            lesson_id,
            completed: completed ?? false,
            last_score: last_score ?? null,
            updated_at: new Date().toISOString(),
        },
        {
            onConflict: "user_id,lesson_id",
        }
    );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
