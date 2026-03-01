import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardView from "@/components/DashboardView";

/**
 * Dashboard Page (Protected)
 *
 * Displays per Pass 3 Dashboard Intelligence:
 * - Current position (level/module/lesson)
 * - Completion percentage (neutral, factual)
 * - Weak concepts (strength score < 0.5, with source lesson links)
 * - Required reviews
 * - Last studied
 *
 * Does NOT include: streaks, points, badges, rewards,
 * comparative rankings, motivational messages, or celebration animations.
 */
export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch subscription status
    const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

    // Fetch progress
    const { data: progress } = await supabase
        .from("progress")
        .select(
            `
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

    // Fetch weak areas
    const { data: weakAreas } = await supabase
        .from("weak_areas")
        .select("*")
        .eq("user_id", user.id)
        .order("error_count", { ascending: false });

    // Calculate stats
    const { count: totalLessons } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true });

    const completedCount = progress?.filter((p) => p.completed).length ?? 0;
    const progressPercentage =
        totalLessons && totalLessons > 0
            ? Math.round((completedCount / totalLessons) * 100)
            : 0;

    // Find current position (most recent incomplete or last completed)
    const currentProgress = progress?.[0];

    return (
        <DashboardView
            user={{ id: user.id, email: user.email ?? "" }}
            subscription={subscription}
            progress={progress ?? []}
            weakAreas={weakAreas ?? []}
            totalLessons={totalLessons ?? 0}
            completedLessons={completedCount}
            progressPercentage={progressPercentage}
            currentProgress={currentProgress}
        />
    );
}
