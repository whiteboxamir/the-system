// ============================================
// THE SYSTEM — Shared TypeScript Types
// ============================================
// Institutional Architecture (Pass 11)

// ---- Database row types ----

export interface User {
    id: string;
    email: string;
    created_at: string;
}

export type SubscriptionStatus =
    | "active"
    | "canceled"
    | "past_due"
    | "unpaid"
    | "trialing"
    | "incomplete";

export interface Subscription {
    id: string;
    user_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: SubscriptionStatus;
    current_period_end: string | null;
    created_at: string;
    updated_at: string;
}

// ---- Institutional hierarchy (Pass 11) ----

export interface Year {
    id: string;
    title: string;
    order: number; // 1 = Foundation, 2 = Intermediate, 3 = Advanced
    description: string | null;
    created_at: string;
}

export interface Term {
    id: string;
    year_id: string;
    title: string;
    order: number; // Global ordering (1–8)
    term_number: number; // Within-year number (1, 2, 3)
    created_at: string;
}

/** @deprecated Use Year/Term hierarchy. Retained for backward compatibility. */
export interface Level {
    id: string;
    title: string;
    order: number;
    created_at: string;
}

export interface Module {
    id: string;
    level_id: string;
    term_id: string | null; // Institutional: links to term
    title: string;
    order: number;
    created_at: string;
}

export interface LessonContent {
    core_idea: string;
    explanation: string;
    key_definitions: { term: string; definition: string }[];
    common_misunderstandings: {
        misunderstanding: string;
        correction: string;
    }[];
    conceptual_contrast: { correct: string; incorrect: string }[];
    preparation_for_testing: string[];
}

export interface Lesson {
    id: string;
    module_id: string;
    title: string;
    content: LessonContent;
    order: number;
    created_at: string;
}

export interface Quiz {
    id: string;
    lesson_id: string;
    created_at: string;
}

export type QuestionType = "conceptual" | "trap" | "contrast" | "definition";

export interface Question {
    id: string;
    quiz_id: string;
    question_text: string;
    type: QuestionType;
    concept_tag: string | null;
    order: number;
    created_at: string;
}

export interface Answer {
    id: string;
    question_id: string;
    answer_text: string;
    is_correct: boolean;
    explanation: string | null;
    order: number;
    created_at: string;
}

// ---- Quiz attempt types (Lesson Checks — Tier 1) ----

export interface AnswerGiven {
    question_id: string;
    answer_id: string;
    correct: boolean;
}

export interface QuizAttempt {
    id: string;
    user_id: string;
    quiz_id: string;
    score: number;
    passed: boolean;
    answers_given: AnswerGiven[];
    created_at: string;
}

// ---- Institutional Assessment types (Tiers 2–4) ----

export type AssessmentType =
    | "lesson_check"
    | "module_exam"
    | "term_exam"
    | "cumulative_review";

export type GradeLetter = "A" | "B" | "C" | "D" | "F";

export interface Assessment {
    id: string;
    type: AssessmentType;
    title: string;
    module_id: string | null;
    term_id: string | null;
    year_id: string | null;
    question_count: number;
    pass_threshold: number;
    max_attempts_per_period: number;
    cooldown_hours: number;
    created_at: string;
}

export interface AssessmentQuestion {
    id: string;
    assessment_id: string;
    question_text: string;
    type: QuestionType;
    concept_tag: string | null;
    source_lesson_id: string | null;
    order: number;
    created_at: string;
}

export interface AssessmentAnswer {
    id: string;
    question_id: string;
    answer_text: string;
    is_correct: boolean;
    explanation: string | null;
    order: number;
    created_at: string;
}

export interface AssessmentAttempt {
    id: string;
    user_id: string;
    assessment_id: string;
    score: number;
    grade: GradeLetter;
    passed: boolean;
    attempt_number: number;
    answers_given: AnswerGiven[];
    feedback_summary: AssessmentFeedbackSummary | null;
    created_at: string;
}

export interface AssessmentFeedbackSummary {
    weak_concepts: string[];
    misunderstandings_identified: string[];
    modules_requiring_review: string[];
}

// ---- Enrollment (Pass 11) ----

export type EnrollmentStatus =
    | "active"
    | "on_review"
    | "completed"
    | "withdrawn";

export interface Enrollment {
    id: string;
    user_id: string;
    current_year_id: string | null;
    current_term_id: string | null;
    current_module_id: string | null;
    current_lesson_id: string | null;
    status: EnrollmentStatus;
    enrolled_at: string;
    last_activity_at: string;
}

// ---- Transcript (Pass 11) ----

export interface TranscriptEntry {
    id: string;
    user_id: string;
    assessment_type: AssessmentType;
    assessment_title: string;
    year_id: string | null;
    term_id: string | null;
    module_id: string | null;
    lesson_id: string | null;
    score: number;
    grade: GradeLetter;
    passed: boolean;
    attempt_count: number;
    first_attempted_at: string;
    completed_at: string;
}

export interface StudentGPA {
    user_id: string;
    gpa: number;
    module_exams_completed: number;
    term_exams_completed: number;
    cumulative_reviews_completed: number;
}

// ---- Progress types ----

export interface Progress {
    id: string;
    user_id: string;
    lesson_id: string;
    completed: boolean;
    last_score: number | null;
    updated_at: string;
}

export interface WeakArea {
    id: string;
    user_id: string;
    concept_tag: string;
    error_count: number;
    last_tested_at: string;
    created_at: string;
}

// ---- API request/response types ----

export interface QuizSubmission {
    quiz_id: string;
    answers: { question_id: string; answer_id: string }[];
}

export interface AssessmentSubmission {
    assessment_id: string;
    answers: { question_id: string; answer_id: string }[];
}

export interface QuizResult {
    score: number;
    passed: boolean;
    total_questions: number;
    correct_count: number;
    feedback: QuestionFeedback[];
}

export interface AssessmentResult {
    score: number;
    grade: GradeLetter;
    passed: boolean;
    total_questions: number;
    correct_count: number;
    feedback: QuestionFeedback[];
    weak_concepts: string[];
    can_retry: boolean;
    next_retry_available_at: string | null;
}

export interface QuestionFeedback {
    question_id: string;
    correct: boolean;
    selected_answer_id: string;
    correct_answer_id: string;
    explanation: string | null;
    concept_tag: string | null;
}

// ---- Enriched types (with joins) ----

/** @deprecated Use YearWithTerms. */
export interface LevelWithModules extends Level {
    modules: Module[];
}

export interface YearWithTerms extends Year {
    terms: Term[];
}

export interface TermWithModules extends Term {
    modules: (Module & { locked: boolean; completed: boolean; exam_passed: boolean })[];
}

export interface ModuleWithLessons extends Module {
    lessons: (Lesson & { locked: boolean; completed: boolean })[];
}

export interface LessonWithQuiz extends Lesson {
    quiz: Quiz | null;
    locked: boolean;
    completed: boolean;
}

/** @deprecated Use InstitutionalDashboard. */
export interface DashboardData {
    current_level: Level | null;
    current_module: Module | null;
    current_lesson: Lesson | null;
    progress_percentage: number;
    total_lessons: number;
    completed_lessons: number;
    weak_areas: WeakArea[];
    required_reviews: string[];
}

export interface InstitutionalDashboard {
    // Current position
    enrollment: Enrollment | null;
    current_year: Year | null;
    current_term: Term | null;
    current_module: Module | null;
    current_lesson: Lesson | null;

    // Term progress
    term_modules_total: number;
    term_modules_completed: number;
    module_lessons_total: number;
    module_lessons_completed: number;

    // Program-wide
    gpa: number | null;
    total_lessons: number;
    completed_lessons: number;

    // Diagnostics
    weak_areas: WeakArea[];
    required_reviews: { concept_tag: string; blocking: boolean }[];
    upcoming_assessment: {
        type: AssessmentType;
        title: string;
    } | null;

    // Activity
    last_activity: {
        lesson_title: string;
        date: string;
    } | null;
}
