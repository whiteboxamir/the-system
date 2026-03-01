-- ============================================
-- THE SYSTEM — Database Schema
-- Supabase (PostgreSQL)
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE question_type AS ENUM ('conceptual', 'trap', 'contrast', 'definition');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete');

-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Trigger to auto-create public user on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SUBSCRIPTIONS
-- ============================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- LEVELS
-- ============================================

CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Levels are publicly readable"
  ON public.levels FOR SELECT
  USING (true);

-- ============================================
-- MODULES
-- ============================================

CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (level_id, "order")
);

CREATE INDEX idx_modules_level_id ON public.modules(level_id);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modules are publicly readable"
  ON public.modules FOR SELECT
  USING (true);

-- ============================================
-- LESSONS
-- ============================================

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_id, "order")
);

-- Content JSONB structure:
-- {
--   "core_idea": "...",
--   "explanation": "...",
--   "key_definitions": [{ "term": "...", "definition": "..." }],
--   "common_misunderstandings": [{ "misunderstanding": "...", "correction": "..." }],
--   "conceptual_contrast": [{ "correct": "...", "incorrect": "..." }],
--   "preparation_for_testing": ["..."]
-- }

CREATE INDEX idx_lessons_module_id ON public.lessons(module_id);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lessons are publicly readable"
  ON public.lessons FOR SELECT
  USING (true);

-- ============================================
-- QUIZZES
-- ============================================

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quizzes_lesson_id ON public.quizzes(lesson_id);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quizzes are publicly readable"
  ON public.quizzes FOR SELECT
  USING (true);

-- ============================================
-- QUESTIONS
-- ============================================

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  type question_type NOT NULL,
  concept_tag TEXT, -- Used for weak area tracking
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, "order")
);

CREATE INDEX idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX idx_questions_concept_tag ON public.questions(concept_tag);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions are publicly readable"
  ON public.questions FOR SELECT
  USING (true);

-- ============================================
-- ANSWERS
-- ============================================

CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  explanation TEXT, -- Corrective feedback shown when this wrong answer is selected
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_answers_question_id ON public.answers(question_id);

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Answers are publicly readable"
  ON public.answers FOR SELECT
  USING (true);

-- ============================================
-- QUIZ ATTEMPTS
-- ============================================

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL, -- Percentage score (0.00–100.00)
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  answers_given JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{ "question_id": "...", "answer_id": "...", "correct": true/false }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_user_quiz ON public.quiz_attempts(user_id, quiz_id);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz attempts"
  ON public.quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PROGRESS
-- ============================================

CREATE TABLE public.progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_score NUMERIC(5, 2), -- Most recent quiz score
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX idx_progress_user_id ON public.progress(user_id);
CREATE INDEX idx_progress_lesson_id ON public.progress(lesson_id);

ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.progress FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- WEAK AREAS
-- ============================================

CREATE TABLE public.weak_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  concept_tag TEXT NOT NULL,
  error_count INTEGER NOT NULL DEFAULT 1,
  last_tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concept_tag)
);

CREATE INDEX idx_weak_areas_user_id ON public.weak_areas(user_id);
CREATE INDEX idx_weak_areas_concept_tag ON public.weak_areas(concept_tag);

ALTER TABLE public.weak_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weak areas"
  ON public.weak_areas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weak areas"
  ON public.weak_areas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weak areas"
  ON public.weak_areas FOR UPDATE
  USING (auth.uid() = user_id);
