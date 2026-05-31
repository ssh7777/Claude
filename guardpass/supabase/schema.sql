-- ============================================================
-- GuardPass Database Schema
-- Run this in the Supabase SQL Editor in order.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE public.profiles (
    id                          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    company_name                TEXT NOT NULL DEFAULT '',
    stripe_customer_id          TEXT,
    stripe_subscription_id      TEXT,
    stripe_subscription_status  TEXT DEFAULT 'trialing',
    stripe_price_id             TEXT,
    current_period_end          TIMESTAMP WITH TIME ZONE,
    ai_answers_this_month       INTEGER DEFAULT 0,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and update their own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, company_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. KNOWLEDGE DOCUMENTS
-- ============================================================
CREATE TABLE public.knowledge_documents (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_name     TEXT NOT NULL,
    file_size     BIGINT,
    file_type     TEXT,
    storage_path  TEXT NOT NULL,
    parsed_text   TEXT,
    token_count   INTEGER,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own knowledge documents"
    ON public.knowledge_documents FOR ALL
    USING (auth.uid() = profile_id);

CREATE INDEX idx_knowledge_documents_profile_id ON public.knowledge_documents(profile_id);


-- ============================================================
-- 3. QUESTIONNAIRES
-- ============================================================
CREATE TABLE public.questionnaires (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title             TEXT NOT NULL,
    original_filename TEXT,
    status            TEXT DEFAULT 'pending',
    total_items       INTEGER DEFAULT 0,
    completed_items   INTEGER DEFAULT 0,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own questionnaires"
    ON public.questionnaires FOR ALL
    USING (auth.uid() = profile_id);

CREATE INDEX idx_questionnaires_profile_id ON public.questionnaires(profile_id);


-- ============================================================
-- 4. QUESTIONNAIRE ITEMS
-- ============================================================
CREATE TABLE public.questionnaire_items (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    questionnaire_id    UUID REFERENCES public.questionnaires(id) ON DELETE CASCADE NOT NULL,
    row_number          INTEGER,
    question_text       TEXT NOT NULL,
    suggested_answer    TEXT,
    user_edited_answer  TEXT,
    confidence_score    NUMERIC(3,2),
    status              TEXT DEFAULT 'pending',
    is_approved         BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.questionnaire_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own questionnaire items"
    ON public.questionnaire_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.questionnaires
            WHERE id = questionnaire_id
            AND profile_id = auth.uid()
        )
    );

CREATE INDEX idx_questionnaire_items_questionnaire_id ON public.questionnaire_items(questionnaire_id);


-- ============================================================
-- 5. TENANT CONFIG (White-label)
-- ============================================================
CREATE TABLE public.tenant_config (
    profile_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    brand_name      TEXT DEFAULT 'GuardPass',
    brand_logo_url  TEXT,
    primary_color   TEXT DEFAULT '#2563EB',
    custom_domain   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own config" ON public.tenant_config FOR ALL USING (auth.uid() = profile_id);


-- ============================================================
-- STORAGE BUCKET RLS POLICIES
-- Create buckets first: 'knowledge-docs' and 'questionnaires' (both private)
-- Then run these policies:
-- ============================================================

CREATE POLICY "Owner can upload knowledge docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can read knowledge docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can delete knowledge docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can upload questionnaires"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'questionnaires' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can read questionnaires"
ON storage.objects FOR SELECT
USING (bucket_id = 'questionnaires' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner can delete questionnaires"
ON storage.objects FOR DELETE
USING (bucket_id = 'questionnaires' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- 6. AUDIT LOG
-- Immutable log of significant user actions for compliance.
-- ============================================================
CREATE TABLE public.audit_logs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,   -- e.g. 'document.upload', 'questionnaire.process', 'item.approve', 'export'
    resource_id UUID,
    metadata    JSONB DEFAULT '{}',
    ip_address  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = profile_id);

CREATE INDEX idx_audit_logs_profile_id ON public.audit_logs(profile_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);


-- ============================================================
-- COMPOSITE INDEXES for common query patterns
-- ============================================================
CREATE INDEX idx_questionnaires_profile_status ON public.questionnaires(profile_id, status);
CREATE INDEX idx_questionnaire_items_status ON public.questionnaire_items(questionnaire_id, status);
