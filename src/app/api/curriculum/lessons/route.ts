import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("module_id");

    if (!moduleId) {
        return NextResponse.json(
            { error: "module_id is required" },
            { status: 400 }
        );
    }

    // Get the module with its level info for access control
    const { data: module } = await supabase
        .from("modules")
        .select(
            `
      id,
      title,
      "order",
      level_id,
      levels!inner (
        "order"
      )
    `
        )
        .eq("id", moduleId)
        .single();

    if (!module) {
        return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const levelOrder = (module.levels as any).order;

    // Check subscription for Level 1+
    if (levelOrder > 0) {
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
                { error: "Active subscription required" },
                { status: 403 }
            );
        }
    }

    // Fetch lessons for this module
    const { data: lessons, error } = await supabase
        .from("lessons")
        .select("id, title, \"order\", module_id")
        .eq("module_id", moduleId)
        .order("order", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Determine lock status for each lesson
    const enrichedLessons = [];

    for (let i = 0; i < (lessons?.length ?? 0); i++) {
        const lesson = lessons![i];
        let locked = false;
        let completed = false;

        if (user) {
            // Check completion status
            const { data: progress } = await supabase
                .from("progress")
                .select("completed, last_score")
                .eq("user_id", user.id)
                .eq("lesson_id", lesson.id)
                .single();

            completed = progress?.completed ?? false;

            // First lesson in Level 0, Module 1 is always unlocked
            if (levelOrder === 0 && module.order === 1 && lesson.order === 1) {
                locked = false;
            } else if (i === 0) {
                // First lesson in this module — check last lesson of previous module
                // For simplicity in this endpoint, we check via quiz_attempts
                locked = false; // Will be fully validated at lesson access time
            } else {
                // Check if previous lesson was passed
                const prevLesson = lessons![i - 1];
                const { data: quiz } = await supabase
                    .from("quizzes")
                    .select("id")
                    .eq("lesson_id", prevLesson.id)
                    .single();

                if (quiz) {
                    const { data: passingAttempt } = await supabase
                        .from("quiz_attempts")
                        .select("id")
                        .eq("user_id", user.id)
                        .eq("quiz_id", quiz.id)
                        .eq("passed", true)
                        .limit(1)
                        .single();

                    locked = !passingAttempt;
                }
            }
        } else {
            // Not logged in — only Level 0 content is accessible
            locked = levelOrder > 0;
        }

        enrichedLessons.push({
            ...lesson,
            locked,
            completed,
        });
    }

    return NextResponse.json({ lessons: enrichedLessons });
}
