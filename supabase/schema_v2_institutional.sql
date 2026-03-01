-- ============================================
-- THE SYSTEM — Institutional Schema Migration (v2)
-- Adds Year/Term hierarchy, tiered assessments,
-- transcripts, and enrollment tracking.
-- Run AFTER schema.sql (v1).
-- ============================================

-- ============================================
-- NEW ENUM TYPES
-- ============================================

CREATE TYPE assessment_type AS ENUM (
    'lesson_check',
    'module_exam',
    'term_exam',
    'cumulative_review'
);

CREATE TYPE grade_letter AS ENUM ('A', 'B', 'C', 'D', 'F');

CREATE TYPE enrollment_status AS ENUM (
    'active',
    'on_review',
    'completed',
    'withdrawn'
);

-- ============================================
-- YEARS
-- ============================================

CREATE TABLE public.years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,              -- 'Foundation Year', 'Intermediate Year', 'Advanced Year'
    "order" INTEGER NOT NULL UNIQUE,  -- 1, 2, 3
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Years are publicly readable"
    ON public.years FOR SELECT
    USING (true);

-- Seed the three years
INSERT INTO public.years (title, "order", description) VALUES
    ('Foundation Year', 1, 'Establish fundamental ideas. Orientation, core concepts, internal structure of man.'),
    ('Intermediate Year', 2, 'Governing laws and structural principles. Laws, Enneagram, cosmological scale.'),
    ('Advanced Year', 3, 'Integration, higher concepts, applied understanding.');

-- ============================================
-- TERMS
-- ============================================

CREATE TABLE public.terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_id UUID NOT NULL REFERENCES public.years(id) ON DELETE CASCADE,
    title TEXT NOT NULL,                -- e.g. 'Term 1 — Orientation & Introduction'
    "order" INTEGER NOT NULL,           -- Global ordering across the program (1–8)
    term_number INTEGER NOT NULL,       -- Within-year number (1, 2, 3)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (year_id, term_number),
    UNIQUE ("order")
);

CREATE INDEX idx_terms_year_id ON public.terms(year_id);

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terms are publicly readable"
    ON public.terms FOR SELECT
    USING (true);

-- Seed all 8 terms
-- Foundation Year terms
INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 1 — Orientation & Introduction', 1, 1
FROM public.years y WHERE y."order" = 1;

INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 2 — Foundations of the System', 2, 2
FROM public.years y WHERE y."order" = 1;

INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 3 — Structure of Man', 3, 3
FROM public.years y WHERE y."order" = 1;

-- Intermediate Year terms
INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 4 — Principles & Laws', 4, 1
FROM public.years y WHERE y."order" = 2;

INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 5 — The Enneagram', 5, 2
FROM public.years y WHERE y."order" = 2;

INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 6 — Cosmological Scale', 6, 3
FROM public.years y WHERE y."order" = 2;

-- Advanced Year terms
INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 7 — States, Bodies, and Development', 7, 1
FROM public.years y WHERE y."order" = 3;

INSERT INTO public.terms (year_id, title, "order", term_number)
SELECT y.id, 'Term 8 — Integration & Applied Understanding', 8, 2
FROM public.years y WHERE y."order" = 3;

-- ============================================
-- LINK MODULES TO TERMS
-- ============================================

-- Add term_id column to existing modules table
ALTER TABLE public.modules
    ADD COLUMN term_id UUID REFERENCES public.terms(id) ON DELETE SET NULL;

CREATE INDEX idx_modules_term_id ON public.modules(term_id);

-- ============================================
-- ASSESSMENTS (Module Exams, Term Exams, Cumulative Reviews)
-- ============================================
-- Note: Lesson Checks remain in the existing `quizzes` table.
-- This table handles the three higher-tier assessment types.

CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type assessment_type NOT NULL,
    title TEXT NOT NULL,                 -- e.g. 'Term 2 Final Examination'
    
    -- Scope references (nullable — depends on type)
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,   -- for module_exam
    term_id UUID REFERENCES public.terms(id) ON DELETE CASCADE,       -- for term_exam
    year_id UUID REFERENCES public.years(id) ON DELETE CASCADE,       -- for cumulative_review
    
    question_count INTEGER NOT NULL DEFAULT 15,
    pass_threshold INTEGER NOT NULL DEFAULT 75,  -- percentage
    max_attempts_per_period INTEGER NOT NULL DEFAULT 3,
    cooldown_hours INTEGER NOT NULL DEFAULT 24,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure correct scope per type
    CONSTRAINT assessment_scope_check CHECK (
        (type = 'module_exam' AND module_id IS NOT NULL) OR
        (type = 'term_exam' AND term_id IS NOT NULL) OR
        (type = 'cumulative_review' AND year_id IS NOT NULL) OR
        (type = 'lesson_check')
    )
);

CREATE INDEX idx_assessments_module_id ON public.assessments(module_id);
CREATE INDEX idx_assessments_term_id ON public.assessments(term_id);
CREATE INDEX idx_assessments_year_id ON public.assessments(year_id);
CREATE INDEX idx_assessments_type ON public.assessments(type);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assessments are publicly readable"
    ON public.assessments FOR SELECT
    USING (true);

-- ============================================
-- ASSESSMENT QUESTIONS
-- ============================================
-- Questions for module/term/cumulative exams.
-- Lesson check questions remain in existing `questions` table.

CREATE TABLE public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    type question_type NOT NULL,       -- reuses existing enum
    concept_tag TEXT,
    source_lesson_id UUID REFERENCES public.lessons(id),  -- which lesson this concept originates from
    "order" INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (assessment_id, "order")
);

CREATE INDEX idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX idx_assessment_questions_concept_tag ON public.assessment_questions(concept_tag);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assessment questions are publicly readable"
    ON public.assessment_questions FOR SELECT
    USING (true);

-- ============================================
-- ASSESSMENT ANSWERS
-- ============================================

CREATE TABLE public.assessment_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    explanation TEXT,
    "order" INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_answers_question_id ON public.assessment_answers(question_id);

ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assessment answers are publicly readable"
    ON public.assessment_answers FOR SELECT
    USING (true);

-- ============================================
-- ASSESSMENT ATTEMPTS
-- ============================================

CREATE TABLE public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    score NUMERIC(5, 2) NOT NULL,        -- 0.00–100.00
    grade grade_letter NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    answers_given JSONB NOT NULL DEFAULT '[]',
    feedback_summary JSONB,              -- summary of misunderstandings identified
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_attempts_user_id ON public.assessment_attempts(user_id);
CREATE INDEX idx_assessment_attempts_assessment_id ON public.assessment_attempts(assessment_id);
CREATE INDEX idx_assessment_attempts_user_assessment ON public.assessment_attempts(user_id, assessment_id);

ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessment attempts"
    ON public.assessment_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessment attempts"
    ON public.assessment_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ENROLLMENT
-- ============================================

CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    current_year_id UUID REFERENCES public.years(id),
    current_term_id UUID REFERENCES public.terms(id),
    current_module_id UUID REFERENCES public.modules(id),
    current_lesson_id UUID REFERENCES public.lessons(id),
    status enrollment_status NOT NULL DEFAULT 'active',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX idx_enrollments_user_id ON public.enrollments(user_id);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrollment"
    ON public.enrollments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollment"
    ON public.enrollments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollment"
    ON public.enrollments FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- TRANSCRIPT
-- ============================================

CREATE TABLE public.transcript_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- What was assessed
    assessment_type assessment_type NOT NULL,
    assessment_title TEXT NOT NULL,
    
    -- Scope references
    year_id UUID REFERENCES public.years(id),
    term_id UUID REFERENCES public.terms(id),
    module_id UUID REFERENCES public.modules(id),
    lesson_id UUID REFERENCES public.lessons(id),
    
    -- Results
    score NUMERIC(5, 2) NOT NULL,
    grade grade_letter NOT NULL,
    passed BOOLEAN NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    
    -- Timestamps
    first_attempted_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (user_id, assessment_type, COALESCE(module_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(lesson_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

CREATE INDEX idx_transcript_entries_user_id ON public.transcript_entries(user_id);
CREATE INDEX idx_transcript_entries_year_id ON public.transcript_entries(year_id);
CREATE INDEX idx_transcript_entries_term_id ON public.transcript_entries(term_id);

ALTER TABLE public.transcript_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transcript"
    ON public.transcript_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transcript entries"
    ON public.transcript_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transcript entries"
    ON public.transcript_entries FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================
-- GPA VIEW
-- ============================================

CREATE OR REPLACE VIEW public.student_gpa AS
SELECT
    user_id,
    ROUND(
        SUM(
            score * CASE
                WHEN assessment_type = 'module_exam' THEN 1.0
                WHEN assessment_type = 'term_exam' THEN 2.0
                WHEN assessment_type = 'cumulative_review' THEN 0.5
                ELSE 0
            END
        ) / NULLIF(
            SUM(
                CASE
                    WHEN assessment_type = 'module_exam' THEN 1.0
                    WHEN assessment_type = 'term_exam' THEN 2.0
                    WHEN assessment_type = 'cumulative_review' THEN 0.5
                    ELSE 0
                END
            ), 0
        ),
        2
    ) AS gpa,
    COUNT(*) FILTER (WHERE assessment_type = 'module_exam') AS module_exams_completed,
    COUNT(*) FILTER (WHERE assessment_type = 'term_exam') AS term_exams_completed,
    COUNT(*) FILTER (WHERE assessment_type = 'cumulative_review') AS cumulative_reviews_completed
FROM public.transcript_entries
WHERE passed = TRUE
    AND assessment_type IN ('module_exam', 'term_exam', 'cumulative_review')
GROUP BY user_id;
