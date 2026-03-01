// ============================================
// THE SYSTEM — Assessment Engine
// ============================================
// Implements Pass 3 (Anti-Distortion Engine) + Pass 11 (Institutional Architecture)
//
// Tier 1: Lesson Checks    — evaluateQuiz() [original]
// Tier 2: Module Exams     — evaluateAssessment()
// Tier 3: Term Exams       — evaluateAssessment()
// Tier 4: Cumulative Reviews — evaluateAssessment()

import type {
    Question,
    Answer,
    QuizResult,
    QuestionFeedback,
    QuizSubmission,
    AssessmentType,
    AssessmentResult,
    AssessmentSubmission,
    AssessmentQuestion,
    AssessmentAnswer,
    AssessmentAttempt,
    GradeLetter,
} from "@/lib/types";

// ---- Pass thresholds (Pass 11, Section IV) ----

/** Lesson check: single-concept precision demands high accuracy */
export const PASS_THRESHOLD = 80;

/** Per-tier thresholds */
export const ASSESSMENT_THRESHOLDS: Record<AssessmentType, number> = {
    lesson_check: 80,
    module_exam: 75,
    term_exam: 70,
    cumulative_review: 70,
};

/** Minimum questions per lesson check (per Pass 3 spec) */
export const MIN_QUESTIONS_PER_QUIZ = 6;

/** Minimum questions per assessment type (Pass 11) */
export const MIN_QUESTIONS_PER_ASSESSMENT: Record<AssessmentType, number> = {
    lesson_check: 6,
    module_exam: 15,
    term_exam: 25,
    cumulative_review: 10,
};

/** Cooldown periods in hours (Pass 11, Section III) */
export const COOLDOWN_HOURS: Record<AssessmentType, number> = {
    lesson_check: 0,
    module_exam: 24,
    term_exam: 48,
    cumulative_review: 24,
};

/** Max attempts per period (Pass 11, Section III) */
export const MAX_ATTEMPTS: Record<AssessmentType, { count: number; period_days: number }> = {
    lesson_check: { count: 3, period_days: 1 },
    module_exam: { count: 3, period_days: 7 },
    term_exam: { count: 2, period_days: 14 },
    cumulative_review: { count: 3, period_days: 7 },
};

// ---- Grade calculation (Pass 11, Section IV) ----

/**
 * Calculate letter grade from numeric score.
 *
 * | Score   | Grade | Classification |
 * |---------|-------|---------------|
 * | 90–100  | A     | Mastery       |
 * | 80–89   | B     | Proficient    |
 * | 70–79   | C     | Adequate      |
 * | 60–69   | D     | Insufficient  |
 * | 0–59    | F     | Failure       |
 */
export function calculateGrade(score: number): GradeLetter {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

/**
 * Get the pass threshold for a given assessment type.
 */
export function getPassThreshold(type: AssessmentType): number {
    return ASSESSMENT_THRESHOLDS[type];
}

// ---- GPA computation (Pass 11, Section IV) ----

interface GradeEntry {
    assessment_type: AssessmentType;
    score: number;
}

/**
 * Compute program GPA from all passed assessment scores.
 *
 * Credit weights per Pass 11:
 * - Module Exams:       1.0
 * - Term Exams:         2.0
 * - Cumulative Reviews: 0.5
 * - Lesson Checks:      0 (not included in GPA)
 */
export function computeGPA(entries: GradeEntry[]): number | null {
    const weights: Record<AssessmentType, number> = {
        lesson_check: 0,
        module_exam: 1.0,
        term_exam: 2.0,
        cumulative_review: 0.5,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const entry of entries) {
        const w = weights[entry.assessment_type];
        if (w === 0) continue;
        weightedSum += entry.score * w;
        totalWeight += w;
    }

    if (totalWeight === 0) return null;

    return Math.round((weightedSum / totalWeight) * 100) / 100;
}

// ---- Tier 1: Lesson Check evaluation (original) ----

/**
 * Evaluate a lesson check (quiz) submission against correct answers.
 * This is the original evaluateQuiz function from Pass 3.
 */
export function evaluateQuiz(
    submission: QuizSubmission,
    questions: Question[],
    correctAnswers: Map<string, Answer>,
    allAnswers: Map<string, Answer>
): QuizResult {
    const totalQuestions = questions.length;
    let correctCount = 0;
    const feedback: QuestionFeedback[] = [];

    for (const question of questions) {
        const userAnswer = submission.answers.find(
            (a) => a.question_id === question.id
        );
        const correct = correctAnswers.get(question.id);

        if (!correct) {
            continue;
        }

        const selectedAnswerId = userAnswer?.answer_id ?? "";
        const isCorrect = selectedAnswerId === correct.id;

        if (isCorrect) {
            correctCount++;
        }

        let explanation: string | null = null;
        if (!isCorrect && selectedAnswerId) {
            const selectedAnswer = allAnswers.get(selectedAnswerId);
            explanation = selectedAnswer?.explanation ?? null;
        }

        feedback.push({
            question_id: question.id,
            correct: isCorrect,
            selected_answer_id: selectedAnswerId,
            correct_answer_id: correct.id,
            explanation,
            concept_tag: question.concept_tag,
        });
    }

    const score =
        totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 10000) / 100
            : 0;

    return {
        score,
        passed: score >= PASS_THRESHOLD,
        total_questions: totalQuestions,
        correct_count: correctCount,
        feedback,
    };
}

// ---- Tiers 2–4: Institutional Assessment evaluation ----

/**
 * Evaluate a module exam, term exam, or cumulative review submission.
 *
 * Similar to evaluateQuiz but returns AssessmentResult with:
 * - Letter grade
 * - Weak concept identification
 * - Retry eligibility
 */
export function evaluateAssessment(
    submission: AssessmentSubmission,
    assessmentType: AssessmentType,
    questions: AssessmentQuestion[],
    correctAnswers: Map<string, AssessmentAnswer>,
    allAnswers: Map<string, AssessmentAnswer>,
    previousAttempts: AssessmentAttempt[]
): AssessmentResult {
    const totalQuestions = questions.length;
    let correctCount = 0;
    const feedback: QuestionFeedback[] = [];
    const incorrectConcepts: Set<string> = new Set();

    for (const question of questions) {
        const userAnswer = submission.answers.find(
            (a) => a.question_id === question.id
        );
        const correct = correctAnswers.get(question.id);

        if (!correct) {
            continue;
        }

        const selectedAnswerId = userAnswer?.answer_id ?? "";
        const isCorrect = selectedAnswerId === correct.id;

        if (isCorrect) {
            correctCount++;
        } else if (question.concept_tag) {
            incorrectConcepts.add(question.concept_tag);
        }

        let explanation: string | null = null;
        if (!isCorrect && selectedAnswerId) {
            const selectedAnswer = allAnswers.get(selectedAnswerId);
            explanation = selectedAnswer?.explanation ?? null;
        }

        feedback.push({
            question_id: question.id,
            correct: isCorrect,
            selected_answer_id: selectedAnswerId,
            correct_answer_id: correct.id,
            explanation,
            concept_tag: question.concept_tag,
        });
    }

    const score =
        totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 10000) / 100
            : 0;

    const threshold = getPassThreshold(assessmentType);
    const grade = calculateGrade(score);
    const passed = score >= threshold;

    // Determine retry eligibility
    const { canRetry, nextRetryAt } = checkRetryEligibility(
        assessmentType,
        previousAttempts
    );

    return {
        score,
        grade,
        passed,
        total_questions: totalQuestions,
        correct_count: correctCount,
        feedback,
        weak_concepts: Array.from(incorrectConcepts),
        can_retry: !passed && canRetry,
        next_retry_available_at: nextRetryAt,
    };
}

// ---- Retry eligibility (Pass 11, Section III & V) ----

/**
 * Determine whether a student can retry an assessment based on
 * attempt limits, cooldown periods, and period restrictions.
 */
export function checkRetryEligibility(
    assessmentType: AssessmentType,
    previousAttempts: AssessmentAttempt[]
): { canRetry: boolean; nextRetryAt: string | null } {
    const limits = MAX_ATTEMPTS[assessmentType];
    const cooldownMs = COOLDOWN_HOURS[assessmentType] * 60 * 60 * 1000;

    const now = Date.now();
    const periodStart = now - limits.period_days * 24 * 60 * 60 * 1000;

    // Count attempts within the current period
    const recentAttempts = previousAttempts.filter(
        (a) => new Date(a.created_at).getTime() >= periodStart
    );

    if (recentAttempts.length >= limits.count) {
        // Max attempts in period reached
        const oldestInPeriod = recentAttempts.reduce(
            (oldest, a) =>
                new Date(a.created_at).getTime() < new Date(oldest.created_at).getTime()
                    ? a
                    : oldest,
            recentAttempts[0]
        );
        const periodEndMs =
            new Date(oldestInPeriod.created_at).getTime() +
            limits.period_days * 24 * 60 * 60 * 1000;
        return {
            canRetry: false,
            nextRetryAt: new Date(periodEndMs).toISOString(),
        };
    }

    // Check cooldown from most recent attempt
    if (previousAttempts.length > 0 && cooldownMs > 0) {
        const mostRecent = previousAttempts.reduce(
            (latest, a) =>
                new Date(a.created_at).getTime() > new Date(latest.created_at).getTime()
                    ? a
                    : latest,
            previousAttempts[0]
        );
        const cooldownEnd =
            new Date(mostRecent.created_at).getTime() + cooldownMs;
        if (now < cooldownEnd) {
            return {
                canRetry: false,
                nextRetryAt: new Date(cooldownEnd).toISOString(),
            };
        }
    }

    return { canRetry: true, nextRetryAt: null };
}

// ---- Concept extraction ----

/**
 * Extract incorrect concept tags from a quiz result for weak area tracking.
 */
export function extractIncorrectConcepts(
    result: QuizResult | AssessmentResult
): { concept_tag: string; question_id: string }[] {
    return result.feedback
        .filter((f) => !f.correct && f.concept_tag)
        .map((f) => ({
            concept_tag: f.concept_tag!,
            question_id: f.question_id,
        }));
}

