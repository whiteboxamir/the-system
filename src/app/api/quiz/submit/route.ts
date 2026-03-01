import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { evaluateQuiz, extractIncorrectConcepts } from "@/lib/quiz-engine";
import { getAttemptCount, getRetryAction } from "@/lib/progression";
import { updateWeakAreas } from "@/lib/weak-areas";
import type { QuizSubmission, Answer, Question } from "@/lib/types";

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

    const body: QuizSubmission = await request.json();
    const { quiz_id, answers: submittedAnswers } = body;

    if (!quiz_id || !submittedAnswers || submittedAnswers.length === 0) {
        return NextResponse.json(
            { error: "quiz_id and answers are required" },
            { status: 400 }
        );
    }

    // Fetch the quiz and verify it exists
    const { data: quiz } = await supabase
        .from("quizzes")
        .select("id, lesson_id")
        .eq("id", quiz_id)
        .single();

    if (!quiz) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Fetch all questions for this quiz
    const { data: questions } = await supabase
        .from("questions")
        .select("id, quiz_id, question_text, type, concept_tag, \"order\"")
        .eq("quiz_id", quiz_id)
        .order("order", { ascending: true });

    if (!questions || questions.length === 0) {
        return NextResponse.json(
            { error: "No questions found for this quiz" },
            { status: 404 }
        );
    }

    // Fetch all answers for these questions
    const questionIds = questions.map((q) => q.id);
    const { data: allAnswersRaw } = await supabase
        .from("answers")
        .select("id, question_id, answer_text, is_correct, explanation, \"order\"")
        .in("question_id", questionIds);

    if (!allAnswersRaw) {
        return NextResponse.json(
            { error: "No answers found" },
            { status: 500 }
        );
    }

    // Build lookup maps
    const correctAnswers = new Map<string, Answer>();
    const allAnswers = new Map<string, Answer>();

    for (const answer of allAnswersRaw) {
        allAnswers.set(answer.id, answer as Answer);
        if (answer.is_correct) {
            correctAnswers.set(answer.question_id, answer as Answer);
        }
    }

    // Evaluate the quiz
    const result = evaluateQuiz(
        body,
        questions as Question[],
        correctAnswers,
        allAnswers
    );

    // Get attempt count for retry logic
    const attemptCount = await getAttemptCount(supabase, user.id, quiz_id);
    const retryAction = result.passed
        ? null
        : getRetryAction(attemptCount + 1);

    // Store the quiz attempt
    const answersGiven = submittedAnswers.map((a) => {
        const correct = correctAnswers.get(a.question_id);
        return {
            question_id: a.question_id,
            answer_id: a.answer_id,
            correct: correct ? a.answer_id === correct.id : false,
        };
    });

    await supabase.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quiz_id,
        score: result.score,
        passed: result.passed,
        answers_given: answersGiven,
    });

    // Update progress
    await supabase
        .from("progress")
        .upsert(
            {
                user_id: user.id,
                lesson_id: quiz.lesson_id,
                completed: result.passed,
                last_score: result.score,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "user_id,lesson_id",
            }
        );

    // Track weak areas for incorrect answers
    const incorrectConcepts = extractIncorrectConcepts(result);
    if (incorrectConcepts.length > 0) {
        await updateWeakAreas(supabase, user.id, incorrectConcepts);
    }

    return NextResponse.json({
        result,
        retry_action: retryAction,
        attempt_number: attemptCount + 1,
    });
}
