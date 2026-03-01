// ============================================
// THE SYSTEM — Progression Logic
// ============================================
// Implements Pass 3 (sequential lesson access) + Pass 11 (institutional progression)
//
// Lesson → Lesson:   pass lesson check (≥ 80%)
// Module → Module:   pass module exam (≥ 75%)
// Term → Term:       pass term exam (≥ 70%) + no weak areas < 0.5
// Year → Year:       all terms + cumulative review (≥ 70%) + GPA ≥ 70

import { SupabaseClient } from "@supabase/supabase-js";
import { PASS_THRESHOLD, ASSESSMENT_THRESHOLDS } from "@/lib/quiz-engine";

// ============================================
// LESSON-LEVEL PROGRESSION (Pass 3 — unchanged)
// ============================================

/**
 * Determines if a user can access a specific lesson.
 *
 * Rules:
 * 1. The very first lesson (Level 0, Module 0.1, Lesson 1) is always accessible.
 * 2. For all other lessons, the previous lesson in sequence must have a
 *    passing quiz attempt (score ≥ 80%).
 * 3. Levels 1+ require an active subscription.
 */
export async function canAccessLesson(
    supabase: SupabaseClient,
    userId: string,
    lessonId: string
): Promise<{ accessible: boolean; reason?: string }> {
    // Get the lesson with its module and level info
    const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select(
            `
      id,
      "order",
      module_id,
      modules!inner (
        id,
        "order",
        level_id,
        levels!inner (
          id,
          "order"
        )
      )
    `
        )
        .eq("id", lessonId)
        .single();

    if (lessonError || !lesson) {
        return { accessible: false, reason: "Lesson not found." };
    }

    const module = lesson.modules as any;
    const level = module.levels as any;
    const levelOrder = level.order as number;
    const moduleOrder = module.order as number;
    const lessonOrder = lesson.order as number;

    // Rule 1: First lesson in Level 0 is always accessible
    if (levelOrder === 0 && moduleOrder === 1 && lessonOrder === 1) {
        return { accessible: true };
    }

    // Rule 3: Check subscription for Level 1+
    if (levelOrder > 0) {
        const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status, current_period_end")
            .eq("user_id", userId)
            .eq("status", "active")
            .single();

        if (!subscription) {
            return {
                accessible: false,
                reason: "An active subscription is required to access this level.",
            };
        }

        // Check if subscription period hasn't ended
        if (
            subscription.current_period_end &&
            new Date(subscription.current_period_end) < new Date()
        ) {
            return {
                accessible: false,
                reason: "Your subscription has expired.",
            };
        }
    }

    // Rule 2: Find the previous lesson and check if its quiz was passed
    const previousLesson = await getPreviousLesson(
        supabase,
        levelOrder,
        moduleOrder,
        lessonOrder
    );

    if (!previousLesson) {
        // No previous lesson found — this shouldn't happen except for the first lesson
        return { accessible: true };
    }

    // Check if previous lesson has a passing quiz attempt
    const { data: quiz } = await supabase
        .from("quizzes")
        .select("id")
        .eq("lesson_id", previousLesson.id)
        .single();

    if (!quiz) {
        // No quiz for the previous lesson — allow access
        return { accessible: true };
    }

    const { data: passingAttempt } = await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("user_id", userId)
        .eq("quiz_id", quiz.id)
        .eq("passed", true)
        .limit(1)
        .single();

    if (!passingAttempt) {
        return {
            accessible: false,
            reason:
                "You must pass the previous lesson's quiz before accessing this lesson.",
        };
    }

    return { accessible: true };
}

/**
 * Find the previous lesson in the sequence.
 * Order: within a module by lesson order, across modules by module order,
 * across levels by level order.
 */
async function getPreviousLesson(
    supabase: SupabaseClient,
    levelOrder: number,
    moduleOrder: number,
    lessonOrder: number
): Promise<{ id: string } | null> {
    // Try previous lesson in same module
    if (lessonOrder > 1) {
        const { data: prevLesson } = await supabase
            .from("lessons")
            .select("id")
            .eq(
                "module_id",
                (
                    await supabase
                        .from("modules")
                        .select("id")
                        .eq(
                            "level_id",
                            (
                                await supabase
                                    .from("levels")
                                    .select("id")
                                    .eq("order", levelOrder)
                                    .single()
                            ).data?.id
                        )
                        .eq("order", moduleOrder)
                        .single()
                ).data?.id
            )
            .eq("order", lessonOrder - 1)
            .single();

        return prevLesson;
    }

    // Try last lesson in previous module (same level)
    if (moduleOrder > 1) {
        const { data: level } = await supabase
            .from("levels")
            .select("id")
            .eq("order", levelOrder)
            .single();

        if (!level) return null;

        const { data: prevModule } = await supabase
            .from("modules")
            .select("id")
            .eq("level_id", level.id)
            .eq("order", moduleOrder - 1)
            .single();

        if (!prevModule) return null;

        const { data: lastLesson } = await supabase
            .from("lessons")
            .select("id")
            .eq("module_id", prevModule.id)
            .order("order", { ascending: false })
            .limit(1)
            .single();

        return lastLesson;
    }

    // Try last lesson in last module of previous level
    if (levelOrder > 0) {
        const { data: prevLevel } = await supabase
            .from("levels")
            .select("id")
            .eq("order", levelOrder - 1)
            .single();

        if (!prevLevel) return null;

        const { data: lastModule } = await supabase
            .from("modules")
            .select("id")
            .eq("level_id", prevLevel.id)
            .order("order", { ascending: false })
            .limit(1)
            .single();

        if (!lastModule) return null;

        const { data: lastLesson } = await supabase
            .from("lessons")
            .select("id")
            .eq("module_id", lastModule.id)
            .order("order", { ascending: false })
            .limit(1)
            .single();

        return lastLesson;
    }

    return null;
}

/**
 * Get the number of quiz attempts a user has made for a specific quiz.
 * Used to implement the retry escalation logic from Pass 3:
 * - Attempt 1 fail: immediate retry
 * - Attempt 2 fail: must revisit lesson
 * - Attempt 3+: prerequisite flagged for review
 */
export async function getAttemptCount(
    supabase: SupabaseClient,
    userId: string,
    quizId: string
): Promise<number> {
    const { count } = await supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("quiz_id", quizId);

    return count ?? 0;
}

/**
 * Determine the appropriate action after a failed quiz attempt.
 */
export type RetryAction =
    | { type: "retry"; message: string }
    | { type: "revisit_lesson"; message: string }
    | { type: "review_required"; message: string };

export function getRetryAction(attemptNumber: number): RetryAction {
    if (attemptNumber <= 1) {
        return {
            type: "retry",
            message:
                "Your score was below 80%. Review the corrective feedback and retry.",
        };
    }

    if (attemptNumber === 2) {
        return {
            type: "revisit_lesson",
            message:
                "You have not passed after two attempts. Revisit the lesson content before your next attempt.",
        };
    }

    return {
        type: "review_required",
        message:
            "This lesson and its prerequisites have been flagged for review. A targeted review is required before progression.",
    };
}

// ============================================
// INSTITUTIONAL PROGRESSION (Pass 11)
// ============================================

/**
 * Determines if a user can access a specific module.
 *
 * Rules (Pass 11, Section V):
 * 1. First module in a term is accessible if the term is accessible.
 * 2. All other modules require the previous module's exam to be passed (≥ 75%).
 * 3. All lessons within the previous module must be completed.
 */
export async function canAccessModule(
    supabase: SupabaseClient,
    userId: string,
    moduleId: string
): Promise<{ accessible: boolean; reason?: string }> {
    // Get the module with its term info
    const { data: mod, error } = await supabase
        .from("modules")
        .select(`id, "order", term_id, level_id`)
        .eq("id", moduleId)
        .single();

    if (error || !mod) {
        return { accessible: false, reason: "Module not found." };
    }

    if (!mod.term_id) {
        // Legacy module without term — fall back to lesson-level checks
        return { accessible: true };
    }

    // Get all modules in this term, ordered
    const { data: termModules } = await supabase
        .from("modules")
        .select(`id, "order"`)
        .eq("term_id", mod.term_id)
        .order("order", { ascending: true });

    if (!termModules || termModules.length === 0) {
        return { accessible: false, reason: "No modules found for this term." };
    }

    // First module in term — accessible if term is accessible
    if (termModules[0].id === moduleId) {
        return { accessible: true };
    }

    // Find the previous module in this term
    const moduleIndex = termModules.findIndex((m) => m.id === moduleId);
    if (moduleIndex <= 0) {
        return { accessible: true };
    }

    const prevModuleId = termModules[moduleIndex - 1].id;

    // Check if all lessons in previous module are completed
    const { data: prevLessons } = await supabase
        .from("lessons")
        .select("id")
        .eq("module_id", prevModuleId);

    if (prevLessons && prevLessons.length > 0) {
        const { count: completedCount } = await supabase
            .from("progress")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .in(
                "lesson_id",
                prevLessons.map((l) => l.id)
            )
            .eq("completed", true);

        if ((completedCount ?? 0) < prevLessons.length) {
            return {
                accessible: false,
                reason:
                    "All lessons in the previous module must be completed before proceeding.",
            };
        }
    }

    // Check if previous module exam was passed
    const { data: moduleExam } = await supabase
        .from("assessments")
        .select("id")
        .eq("module_id", prevModuleId)
        .eq("type", "module_exam")
        .single();

    if (moduleExam) {
        const { data: passingAttempt } = await supabase
            .from("assessment_attempts")
            .select("id")
            .eq("user_id", userId)
            .eq("assessment_id", moduleExam.id)
            .eq("passed", true)
            .limit(1)
            .single();

        if (!passingAttempt) {
            return {
                accessible: false,
                reason:
                    "You must pass the previous module's examination before proceeding.",
            };
        }
    }

    return { accessible: true };
}

/**
 * Determines if a user can access a specific term.
 *
 * Rules (Pass 11, Section V):
 * 1. Term 1 (Orientation) is always accessible.
 * 2. All other terms require:
 *    - Previous term's final exam passed (≥ 70%)
 *    - No weak areas with strength score < 0.5
 */
export async function canAccessTerm(
    supabase: SupabaseClient,
    userId: string,
    termId: string
): Promise<{ accessible: boolean; reason?: string }> {
    // Get the term
    const { data: term, error } = await supabase
        .from("terms")
        .select(`id, "order", year_id`)
        .eq("id", termId)
        .single();

    if (error || !term) {
        return { accessible: false, reason: "Term not found." };
    }

    // First term is always accessible
    if (term.order === 1) {
        return { accessible: true };
    }

    // Find the previous term
    const { data: prevTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("order", term.order - 1)
        .single();

    if (!prevTerm) {
        return { accessible: true };
    }

    // Check if previous term exam was passed
    const { data: termExam } = await supabase
        .from("assessments")
        .select("id")
        .eq("term_id", prevTerm.id)
        .eq("type", "term_exam")
        .single();

    if (termExam) {
        const { data: passingAttempt } = await supabase
            .from("assessment_attempts")
            .select("id")
            .eq("user_id", userId)
            .eq("assessment_id", termExam.id)
            .eq("passed", true)
            .limit(1)
            .single();

        if (!passingAttempt) {
            return {
                accessible: false,
                reason:
                    "You must pass the previous term's final examination before proceeding to this term.",
            };
        }
    }

    // Check for blocking weak areas (strength < 0.5)
    const { data: weakAreas } = await supabase
        .from("weak_areas")
        .select("concept_tag, error_count")
        .eq("user_id", userId);

    if (weakAreas) {
        // Concepts with error_count >= 3 are considered below threshold
        const blockingAreas = weakAreas.filter((w) => w.error_count >= 3);
        if (blockingAreas.length > 0) {
            const concepts = blockingAreas.map((w) => w.concept_tag).join(", ");
            return {
                accessible: false,
                reason: `The following concepts require targeted review before progression: ${concepts}.`,
            };
        }
    }

    return { accessible: true };
}

/**
 * Determines if a user can access a specific year (Year 2 or Year 3).
 *
 * Rules (Pass 11, Section V):
 * 1. Foundation Year (Year 1) is always accessible.
 * 2. Subsequent years require:
 *    - All prior year terms completed (all term exams passed)
 *    - Year-end cumulative review passed (≥ 70%)
 *    - Prior year GPA ≥ 70
 */
export async function canAccessYear(
    supabase: SupabaseClient,
    userId: string,
    yearId: string
): Promise<{ accessible: boolean; reason?: string }> {
    // Get the year
    const { data: year, error } = await supabase
        .from("years")
        .select(`id, "order"`)
        .eq("id", yearId)
        .single();

    if (error || !year) {
        return { accessible: false, reason: "Year not found." };
    }

    // Foundation Year is always accessible
    if (year.order === 1) {
        return { accessible: true };
    }

    // Get the previous year
    const { data: prevYear } = await supabase
        .from("years")
        .select("id")
        .eq("order", year.order - 1)
        .single();

    if (!prevYear) {
        return { accessible: true };
    }

    // Get all terms in the previous year
    const { data: prevTerms } = await supabase
        .from("terms")
        .select("id")
        .eq("year_id", prevYear.id);

    if (!prevTerms || prevTerms.length === 0) {
        return { accessible: true };
    }

    // Check that all term exams in the previous year were passed
    for (const prevTerm of prevTerms) {
        const { data: termExam } = await supabase
            .from("assessments")
            .select("id")
            .eq("term_id", prevTerm.id)
            .eq("type", "term_exam")
            .single();

        if (termExam) {
            const { data: passingAttempt } = await supabase
                .from("assessment_attempts")
                .select("id")
                .eq("user_id", userId)
                .eq("assessment_id", termExam.id)
                .eq("passed", true)
                .limit(1)
                .single();

            if (!passingAttempt) {
                return {
                    accessible: false,
                    reason:
                        "All term examinations in the previous year must be passed before advancing.",
                };
            }
        }
    }

    // Check cumulative review for the previous year
    const { data: cumulativeReview } = await supabase
        .from("assessments")
        .select("id")
        .eq("year_id", prevYear.id)
        .eq("type", "cumulative_review")
        .single();

    if (cumulativeReview) {
        const { data: passingAttempt } = await supabase
            .from("assessment_attempts")
            .select("id")
            .eq("user_id", userId)
            .eq("assessment_id", cumulativeReview.id)
            .eq("passed", true)
            .limit(1)
            .single();

        if (!passingAttempt) {
            return {
                accessible: false,
                reason:
                    "The cumulative review for the previous year must be passed before advancing.",
            };
        }
    }

    // Check previous year GPA ≥ 70
    const { data: transcriptEntries } = await supabase
        .from("transcript_entries")
        .select("score, assessment_type")
        .eq("user_id", userId)
        .eq("year_id", prevYear.id)
        .eq("passed", true)
        .in("assessment_type", ["module_exam", "term_exam"]);

    if (transcriptEntries && transcriptEntries.length > 0) {
        let weightedSum = 0;
        let totalWeight = 0;

        for (const entry of transcriptEntries) {
            const weight = entry.assessment_type === "term_exam" ? 2.0 : 1.0;
            weightedSum += entry.score * weight;
            totalWeight += weight;
        }

        const yearGPA = totalWeight > 0 ? weightedSum / totalWeight : 0;

        if (yearGPA < 70) {
            return {
                accessible: false,
                reason: `Your GPA for the previous year (${Math.round(yearGPA)}) is below the required minimum of 70.`,
            };
        }
    }

    return { accessible: true };
}

// ============================================
// ASSESSMENT ATTEMPT COUNTING (Pass 11)
// ============================================

/**
 * Get the number of assessment attempts a user has made.
 */
export async function getAssessmentAttemptCount(
    supabase: SupabaseClient,
    userId: string,
    assessmentId: string
): Promise<number> {
    const { count } = await supabase
        .from("assessment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("assessment_id", assessmentId);

    return count ?? 0;
}

/**
 * Determine the appropriate action after a failed institutional assessment.
 */
export type InstitutionalRetryAction =
    | { type: "retry"; message: string; cooldown_hours: number }
    | { type: "module_review"; message: string; modules_to_review: string[] }
    | { type: "term_review"; message: string }
    | { type: "blocked"; message: string; next_retry_at: string };

export function getInstitutionalRetryAction(
    assessmentType: "module_exam" | "term_exam" | "cumulative_review",
    attemptNumber: number,
    weakConcepts: string[]
): InstitutionalRetryAction {
    if (assessmentType === "module_exam") {
        if (attemptNumber <= 2) {
            return {
                type: "retry",
                message:
                    "Your score was below 75%. Review the corrective feedback. A minimum 24-hour interval is required before your next attempt.",
                cooldown_hours: 24,
            };
        }
        return {
            type: "module_review",
            message:
                "You have not passed after three attempts within the allowed period. All module lessons have been flagged for review.",
            modules_to_review: weakConcepts,
        };
    }

    if (assessmentType === "term_exam") {
        if (attemptNumber <= 1) {
            return {
                type: "retry",
                message:
                    "Your score was below 70%. A full term review is required. A minimum 48-hour interval is required before your next attempt.",
                cooldown_hours: 48,
            };
        }
        return {
            type: "term_review",
            message:
                "You have not passed after two attempts within the allowed period. A mandatory review cycle has been initiated. Specific module weaknesses have been identified for targeted review.",
        };
    }

    // cumulative_review
    return {
        type: "module_review",
        message:
            "The cumulative review has identified concepts requiring re-study. Targeted review assignments have been generated.",
        modules_to_review: weakConcepts,
    };
}

