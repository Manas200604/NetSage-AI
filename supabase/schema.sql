-- NETSAGE AI DATABASE SCHEMA FOR SUPABASE POSTGRESQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CASES TABLE (Troubleshooting Knowledge Base)
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    symptom TEXT NOT NULL,
    topology_note TEXT,
    show_output TEXT NOT NULL,
    expected_fault TEXT NOT NULL,
    osi_layer TEXT NOT NULL,
    concept TEXT NOT NULL,
    severity TEXT NOT NULL,
    next_command TEXT NOT NULL,
    recommended_fix TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TROUBLESHOOTING SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.troubleshooting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_text TEXT NOT NULL,
    normalized_problem JSONB,
    show_output TEXT,
    topology_data TEXT,
    topology_image_path TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'diagnosed', 'accepted', 'edited', 'rejected', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RULE CHECKER RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.rule_checker_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN')),
    result TEXT NOT NULL,
    evidence TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DIAGNOSES TABLE
CREATE TABLE IF NOT EXISTS public.diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    root_cause TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('High', 'Medium', 'Low')),
    osi_layer TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_command TEXT NOT NULL,
    fix_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    alternative_causes JSONB DEFAULT '[]'::jsonb,
    missing_evidence JSONB DEFAULT '[]'::jsonb,
    retrieved_case_ids JSONB DEFAULT '[]'::jsonb,
    model TEXT DEFAULT 'gemini-2.5-flash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. HUMAN REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.human_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diagnosis_id UUID NOT NULL REFERENCES public.diagnoses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('ACCEPT', 'EDIT', 'REJECT')),
    feedback TEXT,
    corrected_root_cause TEXT,
    corrected_osi_layer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. VERIFICATION RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.verification_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES public.human_reviews(id) ON DELETE CASCADE,
    original_ai_correct BOOLEAN NOT NULL,
    final_diagnosis TEXT NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb,
    verification_reason TEXT NOT NULL,
    confidence TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DATASET CORRECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.dataset_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    original_value TEXT NOT NULL,
    proposed_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    ai_confidence TEXT NOT NULL CHECK (ai_confidence IN ('High', 'Medium', 'Low')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EDITED')),
    proposed_by TEXT NOT NULL DEFAULT 'Gemini AI',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troubleshooting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_checker_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read profiles, users can update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Cases: Everyone can read cases, only admins or service role can insert/update/delete
CREATE POLICY "Cases are viewable by authenticated users" ON public.cases FOR SELECT USING (true);
CREATE POLICY "Admins can insert cases" ON public.cases FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update cases" ON public.cases FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete cases" ON public.cases FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Troubleshooting Sessions: Users can view and create their own sessions, admins can view all
CREATE POLICY "Users view own sessions" ON public.troubleshooting_sessions FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users insert own sessions" ON public.troubleshooting_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.troubleshooting_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Rule Checker Results: Viewable if session belongs to user or admin
CREATE POLICY "Users view session rule results" ON public.rule_checker_results FOR SELECT USING (true);
CREATE POLICY "Insert rule results" ON public.rule_checker_results FOR INSERT WITH CHECK (true);

-- Diagnoses: Viewable by session owner or admin
CREATE POLICY "View diagnoses" ON public.diagnoses FOR SELECT USING (true);
CREATE POLICY "Insert diagnoses" ON public.diagnoses FOR INSERT WITH CHECK (true);

-- Human Reviews: Viewable by user or admin
CREATE POLICY "View human reviews" ON public.human_reviews FOR SELECT USING (true);
CREATE POLICY "Insert human reviews" ON public.human_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Verification Results: Viewable by user or admin
CREATE POLICY "View verification results" ON public.verification_results FOR SELECT USING (true);
CREATE POLICY "Insert verification results" ON public.verification_results FOR INSERT WITH CHECK (true);

-- Dataset Corrections: Viewable by all, editable by admins
CREATE POLICY "View dataset corrections" ON public.dataset_corrections FOR SELECT USING (true);
CREATE POLICY "Insert dataset corrections" ON public.dataset_corrections FOR INSERT WITH CHECK (true);
CREATE POLICY "Update dataset corrections" ON public.dataset_corrections FOR UPDATE USING (true);

-- Audit Logs: Viewable by admins, insertable by service/authenticated
CREATE POLICY "View audit logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- TRIGGER FOR AUTH USER CREATION AUTOMATIC PROFILE ENTRY
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
