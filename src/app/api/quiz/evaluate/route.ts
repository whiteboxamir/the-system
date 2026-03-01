import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { evaluateQuiz } from "@/lib/quiz-engine";
import type { QuizSubmission, Answer, Question } from "@/lib/types";

/**
 * Lightweight evaluation endpoint — evaluates answers and returns feedback
 * WITHOUT storing an attempt. Used for preview/practice.
 */
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

    if (!quiz_id || !submittedAnswers) {
        return NextResponse.json(
            { error: "quiz_id and answers are required" },
            { status: 400 }
        );
    }

    // Fetch questions
    const { data: questions } = await supabase
        .from("questions")
        .select("id, quiz_id, question_text, type, concept_tag, \"order\"")
        .eq("quiz_id", quiz_id)
        .order("order", { ascending: true });

    if (!questions || questions.length === 0) {
        return NextResponse.json(
            { error: "No questions found" },
            { status: 404 }
        );
    }

    // Fetch answers
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

    const correctAnswers = new Map<string, Answer>();
    const allAnswers = new Map<string, Answer>();

    for (const answer of allAnswersRaw) {
        allAnswers.set(answer.id, answer as Answer);
        if (answer.is_correct) {
            correctAnswers.set(answer.question_id, answer as Answer);
        }
    }

    const result = evaluateQuiz(
        body,
        questions as Question[],
        correctAnswers,
        allAnswers
    );

    return NextResponse.json({ result });
}
