// ============================================
// THE SYSTEM — Weak Area Tracking
// ============================================
// Implements Pass 3: Weak Area Tracking Model
// - Tracks incorrect answers by concept_tag
// - Maintains error counts per concept per user
// - Feeds into the review system

import { SupabaseClient } from "@supabase/supabase-js";
import type { WeakArea } from "@/lib/types";

/**
 * Update weak areas based on incorrect quiz answers.
 * For each incorrect concept_tag:
 * - If the concept is new: insert a new weak_areas row
 * - If it already exists: increment error_count and update last_tested_at
 */
export async function updateWeakAreas(
    supabase: SupabaseClient,
    userId: string,
    incorrectConcepts: { concept_tag: string; question_id: string }[]
): Promise<void> {
    if (incorrectConcepts.length === 0) return;

    // Deduplicate concept_tags (a quiz may test the same concept multiple times)
    const uniqueTags = [...new Set(incorrectConcepts.map((c) => c.concept_tag))];

    for (const tag of uniqueTags) {
        const errorCount = incorrectConcepts.filter(
            (c) => c.concept_tag === tag
        ).length;

        // Try to update existing weak area
        const { data: existing } = await supabase
            .from("weak_areas")
            .select("id, error_count")
            .eq("user_id", userId)
            .eq("concept_tag", tag)
            .single();

        if (existing) {
            await supabase
                .from("weak_areas")
                .update({
                    error_count: existing.error_count + errorCount,
                    last_tested_at: new Date().toISOString(),
                })
                .eq("id", existing.id);
        } else {
            await supabase.from("weak_areas").insert({
                user_id: userId,
                concept_tag: tag,
                error_count: errorCount,
                last_tested_at: new Date().toISOString(),
            });
        }
    }
}

/**
 * Get all weak areas for a user, ordered by error count (highest first).
 */
export async function getWeakAreas(
    supabase: SupabaseClient,
    userId: string
): Promise<WeakArea[]> {
    const { data, error } = await supabase
        .from("weak_areas")
        .select("*")
        .eq("user_id", userId)
        .order("error_count", { ascending: false });

    if (error) {
        console.error("Error fetching weak areas:", error);
        return [];
    }

    return data ?? [];
}

/**
 * Get concept tags that require review (error_count above threshold).
 * Per Pass 3: concepts with strength < 0.5 are flagged.
 * Since we track error_count (not strength_score), we flag concepts
 * with error_count >= 3 as requiring review.
 */
export const REVIEW_THRESHOLD = 3;

export async function getRequiredReviews(
    supabase: SupabaseClient,
    userId: string
): Promise<string[]> {
    const { data } = await supabase
        .from("weak_areas")
        .select("concept_tag")
        .eq("user_id", userId)
        .gte("error_count", REVIEW_THRESHOLD);

    return data?.map((d) => d.concept_tag) ?? [];
}
