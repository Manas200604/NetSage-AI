-- NETSAGE AI DATABASE SCHEMA FOR SUPABASE POSTGRESQL (ITERATIVE GUIDED TROUBLESHOOTING)

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

-- 2. CASES TABLE (255+ Troubleshooting Knowledge Base)
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

-- 3. TROUBLESHOOTING SESSIONS TABLE (Multi-Iteration Session Tracker)
CREATE TABLE IF NOT EXISTS public.troubleshooting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_text TEXT NOT NULL,
    normalized_problem JSONB,
    current_iteration INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'need_more_data', 'fix_recommended', 'ready_for_verification', 'resolved', 'unresolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TROUBLESHOOTING LOGS TABLE (Stores CLI Command Outputs Per Iteration)
CREATE TABLE IF NOT EXISTS public.troubleshooting_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    iteration_number INT NOT NULL DEFAULT 1,
    device_name TEXT DEFAULT 'Router/Switch',
    command TEXT,
    raw_output TEXT NOT NULL,
    cleaned_output TEXT,
    structured_facts JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. RULE CHECKER RESULTS TABLE (Python Deterministic Rule Findings Per Iteration)
CREATE TABLE IF NOT EXISTS public.rule_checker_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    log_id UUID REFERENCES public.troubleshooting_logs(id) ON DELETE CASCADE,
    iteration_number INT NOT NULL DEFAULT 1,
    rule_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL', 'WARN')),
    finding TEXT NOT NULL,
    evidence TEXT,
    severity TEXT NOT NULL DEFAULT 'SEV-2' CHECK (severity IN ('SEV-1', 'SEV-2', 'SEV-3', 'Low', 'Medium', 'High', 'Critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AI RESPONSES TABLE (Guided Gemini Responses Per Iteration)
CREATE TABLE IF NOT EXISTS public.ai_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    iteration_number INT NOT NULL DEFAULT 1,
    prompt_context JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'FIX_RECOMMENDED',
    root_cause TEXT,
    osi_layer TEXT NOT NULL DEFAULT 'Layer 3',
    confidence TEXT NOT NULL DEFAULT 'High' CHECK (confidence IN ('High', 'Medium', 'Low')),
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    what_i_found TEXT NOT NULL,
    next_command TEXT NOT NULL,
    why_this_command TEXT,
    expected_output TEXT,
    fix_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    test_steps JSONB DEFAULT '[]'::jsonb,
    what_to_submit_next TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. HUMAN REVIEWS TABLE (Mandatory Review Per Iteration)
CREATE TABLE IF NOT EXISTS public.human_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    iteration_number INT NOT NULL DEFAULT 1,
    ai_response_id UUID REFERENCES public.ai_responses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('ACCEPT', 'EDIT', 'REJECT')),
    feedback TEXT,
    corrected_root_cause TEXT,
    corrected_osi_layer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. VERIFICATION RESULTS TABLE (Packet Tracer Re-Test Verification)
CREATE TABLE IF NOT EXISTS public.verification_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
    iteration_number INT NOT NULL DEFAULT 1,
    test_result TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('RESOLVED', 'UNRESOLVED')),
    evidence JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DATASET CORRECTIONS TABLE
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

-- 10. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS) POLICIES ENFORCEMENT

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troubleshooting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troubleshooting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_checker_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
CREATE POLICY "Public profiles are viewable by authenticated users" 
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Cases RLS
CREATE POLICY "Cases viewable by authenticated users" 
  ON public.cases FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins insert cases" 
  ON public.cases FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins update cases" 
  ON public.cases FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins delete cases" 
  ON public.cases FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Troubleshooting Sessions RLS (User Isolation)
CREATE POLICY "Users view own sessions or admins view all" 
  ON public.troubleshooting_sessions FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users insert own sessions" 
  ON public.troubleshooting_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions" 
  ON public.troubleshooting_sessions FOR UPDATE USING (auth.uid() = user_id);

-- 4. Troubleshooting Logs RLS
CREATE POLICY "Users view session logs" 
  ON public.troubleshooting_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.troubleshooting_sessions s 
      WHERE s.id = session_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
);

CREATE POLICY "Insert session logs" 
  ON public.troubleshooting_logs FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.troubleshooting_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

-- 5. Rule Checker Results RLS
CREATE POLICY "Users view session rule results" 
  ON public.rule_checker_results FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.troubleshooting_sessions s 
      WHERE s.id = session_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
);

CREATE POLICY "Insert rule results" 
  ON public.rule_checker_results FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.troubleshooting_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

-- 6. AI Responses RLS
CREATE POLICY "Users view session AI responses" 
  ON public.ai_responses FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.troubleshooting_sessions s 
      WHERE s.id = session_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
);

CREATE POLICY "Insert AI responses" 
  ON public.ai_responses FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.troubleshooting_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

-- 7. Human Reviews RLS
CREATE POLICY "Users view own reviews" 
  ON public.human_reviews FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users insert own reviews" 
  ON public.human_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. Verification Results RLS
CREATE POLICY "Users view verification results" 
  ON public.verification_results FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.troubleshooting_sessions s 
      WHERE s.id = session_id AND (s.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
);

CREATE POLICY "Insert verification results" 
  ON public.verification_results FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.troubleshooting_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

-- 9. Dataset Corrections RLS
CREATE POLICY "View dataset corrections" 
  ON public.dataset_corrections FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users insert corrections" 
  ON public.dataset_corrections FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Only admins update dataset corrections" 
  ON public.dataset_corrections FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 10. Audit Logs RLS
CREATE POLICY "Admins view audit logs" 
  ON public.audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Insert audit logs" 
  ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

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
