"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuizQuestion {
    id: string;
    question_text: string;
    type: string;
    order: number;
}

interface QuizAnswer {
    id: string;
    question_id: string;
    answer_text: string;
    order: number;
}

interface QuestionFeedback {
    question_id: string;
    correct: boolean;
    selected_answer_id: string;
    correct_answer_id: string;
    explanation: string | null;
    concept_tag: string | null;
}

interface QuizResult {
    score: number;
    passed: boolean;
    total_questions: number;
    correct_count: number;
    feedback: QuestionFeedback[];
}

interface Props {
    quizId: string;
    lessonTitle: string;
    questions: QuizQuestion[];
    answers: QuizAnswer[];
    backUrl: string;
}

export default function QuizInterface({
    quizId,
    lessonTitle,
    questions,
    answers,
    backUrl,
}: Props) {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<
        Record<string, string>
    >({});
    const [result, setResult] = useState<QuizResult | null>(null);
    const [retryAction, setRetryAction] = useState<{
        type: string;
        message: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentQuestion = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;
    const allAnswered = questions.every((q) => selectedAnswers[q.id]);

    function selectAnswer(questionId: string, answerId: string) {
        if (result) return;
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: answerId,
        }));
    }

    function goToNext() {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }

    function goToPrev() {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    }

    async function submitQuiz() {
        if (!allAnswered) {
            setError("All questions must be answered before submitting.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/quiz/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quiz_id: quizId,
                    answers: Object.entries(selectedAnswers).map(
                        ([question_id, answer_id]) => ({
                            question_id,
                            answer_id,
                        })
                    ),
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Submission failed");
            }

            const data = await response.json();
            setResult(data.result);
            setRetryAction(data.retry_action);
            setCurrentIndex(0);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "An error occurred"
            );
        } finally {
            setLoading(false);
        }
    }

    function getAnswersForQuestion(questionId: string) {
        return answers.filter((a) => a.question_id === questionId);
    }

    function getFeedbackForQuestion(
        questionId: string
    ): QuestionFeedback | undefined {
        return result?.feedback.find((f) => f.question_id === questionId);
    }

    // ── Results View ────────────────────────────────────────────
    if (result) {
        return (
            <main className="max-w-3xl mx-auto px-6 py-12">
                <a
                    href={backUrl}
                    className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 no-underline mb-8"
                >
                    ← Back to Lesson
                </a>

                <div className="max-w-xl">
                    <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-6">
                        Quiz: {lessonTitle}
                    </h1>

                    <div
                        className={`px-5 py-4 rounded mb-8 border-l-3 ${result.passed
                                ? "bg-emerald-50 border-emerald-600"
                                : "bg-red-50 border-red-600"
                            }`}
                    >
                        <p className="text-lg font-semibold text-neutral-900 mb-1">
                            Score: {result.score}% —{" "}
                            {result.passed ? "Passed" : "Not Passed"}
                        </p>
                        <p className="text-sm text-neutral-600 m-0">
                            {result.correct_count} of{" "}
                            {result.total_questions} correct.
                        </p>
                        {result.passed && (
                            <p className="text-sm text-neutral-600 mt-1 m-0">
                                Next lesson unlocked.
                            </p>
                        )}
                        {retryAction && (
                            <p className="text-sm text-neutral-600 mt-1 m-0">
                                {retryAction.message}
                            </p>
                        )}
                    </div>

                    {/* All questions with feedback */}
                    {questions.map((question, index) => {
                        const questionAnswers = getAnswersForQuestion(
                            question.id
                        );
                        const feedback = getFeedbackForQuestion(
                            question.id
                        );
                        const selectedId = selectedAnswers[question.id];

                        return (
                            <div key={question.id} className="mb-8">
                                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                                    Question {index + 1}
                                </p>
                                <p className="text-base text-neutral-800 mb-4 leading-relaxed">
                                    {question.question_text}
                                </p>

                                <div className="space-y-2">
                                    {questionAnswers.map((answer) => {
                                        const isSelected =
                                            selectedId === answer.id;
                                        let classes =
                                            "flex items-start gap-3 px-4 py-3 border rounded text-sm";
                                        if (isSelected && feedback) {
                                            classes += feedback.correct
                                                ? " border-emerald-300 bg-emerald-50"
                                                : " border-red-300 bg-red-50";
                                        } else {
                                            classes +=
                                                " border-neutral-200 bg-white";
                                        }

                                        return (
                                            <div
                                                key={answer.id}
                                                className={classes}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`question-${question.id}`}
                                                    value={answer.id}
                                                    checked={isSelected}
                                                    disabled
                                                    className="mt-0.5 accent-neutral-600"
                                                />
                                                <span className="text-neutral-800">
                                                    {answer.answer_text}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {feedback &&
                                    !feedback.correct &&
                                    feedback.explanation && (
                                        <div className="mt-3 px-4 py-3 bg-red-50 border-l-3 border-red-400 text-sm text-neutral-600">
                                            <p className="m-0">
                                                {feedback.explanation}
                                            </p>
                                        </div>
                                    )}
                            </div>
                        );
                    })}

                    <div className="flex gap-3 mt-8">
                        {result.passed ? (
                            <button
                                onClick={() => router.back()}
                                className="btn"
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setResult(null);
                                    setRetryAction(null);
                                    setSelectedAnswers({});
                                    setCurrentIndex(0);
                                }}
                                className="btn"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    // ── Question View (one at a time) ───────────────────────────
    const questionAnswers = getAnswersForQuestion(currentQuestion.id);
    const selectedId = selectedAnswers[currentQuestion.id];

    return (
        <main className="max-w-3xl mx-auto px-6 py-12">
            <a
                href={backUrl}
                className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 no-underline mb-8"
            >
                ← Back to Lesson
            </a>

            <div className="max-w-xl">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
                    Quiz: {lessonTitle}
                </h1>

                <p className="text-sm text-neutral-400 font-medium mb-8">
                    Question {currentIndex + 1} of {questions.length}
                </p>

                <div className="mb-8">
                    <p className="text-base text-neutral-800 mb-6 leading-relaxed">
                        {currentQuestion.question_text}
                    </p>

                    <div className="space-y-2">
                        {questionAnswers.map((answer) => {
                            const isSelected = selectedId === answer.id;
                            return (
                                <div
                                    key={answer.id}
                                    className={`flex items-start gap-3 px-4 py-3 border rounded cursor-pointer transition-colors duration-150 text-sm ${isSelected
                                            ? "border-neutral-400 bg-neutral-100"
                                            : "border-neutral-200 bg-white hover:bg-neutral-50"
                                        }`}
                                    onClick={() =>
                                        selectAnswer(
                                            currentQuestion.id,
                                            answer.id
                                        )
                                    }
                                >
                                    <input
                                        type="radio"
                                        name={`question-${currentQuestion.id}`}
                                        value={answer.id}
                                        checked={isSelected}
                                        onChange={() =>
                                            selectAnswer(
                                                currentQuestion.id,
                                                answer.id
                                            )
                                        }
                                        className="mt-0.5 accent-neutral-600"
                                    />
                                    <span className="text-neutral-800">
                                        {answer.answer_text}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-700 mb-4">{error}</p>
                )}

                <div className="flex gap-3">
                    {currentIndex > 0 && (
                        <button
                            className="btn btn-secondary"
                            onClick={goToPrev}
                        >
                            Previous
                        </button>
                    )}
                    {!isLastQuestion ? (
                        <button
                            onClick={goToNext}
                            disabled={!selectedId}
                            className="btn disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={submitQuiz}
                            disabled={loading || !allAnswered}
                            className="btn disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Submitting…" : "Submit Answers"}
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
