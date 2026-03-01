import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QuizInterface from "@/components/QuizInterface";

/**
 * Quiz Page — Fetches quiz data and renders the interactive quiz component.
 * The actual quiz interaction happens client-side in QuizInterface.
 */
export default async function QuizPage({
    params,
}: {
    params: Promise<{ levelId: string; moduleId: string; lessonId: string }>;
}) {
    const { levelId, moduleId, lessonId } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Fetch quiz for this lesson
    const { data: quiz } = await supabase
        .from("quizzes")
        .select("id")
        .eq("lesson_id", lessonId)
        .single();

    if (!quiz) {
        notFound();
    }

    // Fetch questions
    const { data: questions } = await supabase
        .from("questions")
        .select("id, question_text, type, \"order\"")
        .eq("quiz_id", quiz.id)
        .order("order", { ascending: true });

    // Fetch answers (excluding is_correct and explanation for client-side)
    const questionIds = questions?.map((q) => q.id) ?? [];
    const { data: answers } = await supabase
        .from("answers")
        .select("id, question_id, answer_text, \"order\"")
        .in("question_id", questionIds)
        .order("order", { ascending: true });

    // Fetch lesson title for display
    const { data: lesson } = await supabase
        .from("lessons")
        .select("title")
        .eq("id", lessonId)
        .single();

    return (
        <QuizInterface
            quizId={quiz.id}
            lessonTitle={lesson?.title ?? "Quiz"}
            questions={questions ?? []}
            answers={answers ?? []}
            backUrl={`/levels/${levelId}/${moduleId}/${lessonId}`}
        />
    );
}
