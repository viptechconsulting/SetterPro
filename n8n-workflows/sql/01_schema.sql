-- ============================================================
-- VIP Tech Consulting – Email AI Draft System
-- Database Schema
-- Compatible with PostgreSQL 14+ and Supabase
-- ============================================================

-- Enable UUID extension (Supabase already enables this by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: ai_email_drafts
-- Stores every email processed and its AI-generated draft
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_email_drafts (
  id                      SERIAL PRIMARY KEY,
  message_id              TEXT UNIQUE NOT NULL,
  thread_id               TEXT,
  draft_id                TEXT,
  quickbooks_customer_id  TEXT,
  from_email              TEXT NOT NULL,
  customer_name           TEXT,
  company_name            TEXT,
  original_subject        TEXT,
  original_body           TEXT,
  ai_case_summary         TEXT,
  ai_risk_level           TEXT CHECK (ai_risk_level IN ('low', 'medium', 'high', 'bajo', 'medio', 'alto')),
  ai_suggested_reply      TEXT,
  ai_suggested_subject    TEXT,
  reasoning_for_human     TEXT,
  human_review_notes      JSONB DEFAULT '[]',
  status                  TEXT NOT NULL DEFAULT 'pending_review'
                            CHECK (status IN ('pending_review', 'approved', 'edited', 'rejected', 'sent', 'error')),
  approved_by             TEXT,
  approved_at             TIMESTAMP WITH TIME ZONE,
  rejection_reason        TEXT,
  human_feedback          TEXT,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_status        ON public.ai_email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_from_email    ON public.ai_email_drafts(from_email);
CREATE INDEX IF NOT EXISTS idx_email_drafts_qb_customer   ON public.ai_email_drafts(quickbooks_customer_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at    ON public.ai_email_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_thread_id     ON public.ai_email_drafts(thread_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_email_drafts_updated_at ON public.ai_email_drafts;
CREATE TRIGGER trg_ai_email_drafts_updated_at
  BEFORE UPDATE ON public.ai_email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE 2: ai_email_feedback_lessons
-- Stores learning extracted from human edits/rejections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_email_feedback_lessons (
  id                      SERIAL PRIMARY KEY,
  draft_id                TEXT REFERENCES public.ai_email_drafts(message_id) ON DELETE SET NULL,
  quickbooks_customer_id  TEXT,
  from_email              TEXT,
  domain                  TEXT,
  situation_type          TEXT,
  original_ai_reply       TEXT,
  human_feedback          TEXT,
  revised_reply           TEXT,
  lesson                  TEXT,
  lesson_embedding        VECTOR(1536),  -- optional: for semantic search with pgvector
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_from_email   ON public.ai_email_feedback_lessons(from_email);
CREATE INDEX IF NOT EXISTS idx_lessons_domain       ON public.ai_email_feedback_lessons(domain);
CREATE INDEX IF NOT EXISTS idx_lessons_qb_customer  ON public.ai_email_feedback_lessons(quickbooks_customer_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at   ON public.ai_email_feedback_lessons(created_at DESC);

-- Note: If pgvector is not available, remove the lesson_embedding column
-- ALTER TABLE public.ai_email_feedback_lessons DROP COLUMN IF EXISTS lesson_embedding;

-- ============================================================
-- TABLE 3: company_email_policies
-- Stores internal company rules used in every AI prompt
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_email_policies (
  id          SERIAL PRIMARY KEY,
  policy_name TEXT NOT NULL,
  policy_text TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  priority    INTEGER DEFAULT 1,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SEED DATA: Default Company Policies
-- ============================================================
INSERT INTO public.company_email_policies (policy_name, policy_text, category, priority, active)
VALUES
  (
    'No envío automático',
    'Nunca enviar emails automáticamente sin aprobación humana. Todos los drafts requieren revisión antes de ser enviados.',
    'operaciones',
    1,
    true
  ),
  (
    'Sin precios no aprobados',
    'No proporcionar precios exactos si no existe una cotización aprobada formalmente por la gerencia de VIP Tech Consulting.',
    'comercial',
    2,
    true
  ),
  (
    'Sin compromisos de entrega sin validación',
    'No prometer fechas de entrega ni plazos sin validar disponibilidad del equipo y aprobación del project manager.',
    'operaciones',
    3,
    true
  ),
  (
    'Sin scope creep implícito',
    'No aceptar trabajo fuera del scope del contrato como si estuviera incluido. Siempre proponer revisión del alcance y cotización adicional para trabajo nuevo.',
    'comercial',
    4,
    true
  ),
  (
    'Cliente con balance vencido',
    'Si el cliente tiene balance vencido o facturas pendientes, responder con cordialidad y profesionalismo, pero no comprometer nuevo trabajo hasta revisión y aprobación del área administrativa.',
    'financiero',
    5,
    true
  ),
  (
    'Cliente molesto – empatía sin admisión',
    'Si el cliente expresa insatisfacción o molestia, responder con empatía genuina. No aceptar culpa legal, financiera ni admitir errores sin validación interna previa.',
    'relaciones',
    6,
    true
  ),
  (
    'Tono profesional y orientado a soluciones',
    'Mantener siempre un tono profesional, cercano, claro y orientado a soluciones. Evitar tecnicismos innecesarios y comunicar con claridad los próximos pasos.',
    'comunicacion',
    7,
    true
  ),
  (
    'Protección comercial primero',
    'Siempre proteger los intereses comerciales y legales de VIP Tech Consulting, sin sacrificar la calidad del servicio al cliente.',
    'legal',
    8,
    true
  ),
  (
    'Solicitudes de descuento',
    'No ofrecer descuentos sin autorización expresa de la gerencia. Ante solicitudes de descuento, agradecer la confianza y comunicar que se escalaría internamente para evaluación.',
    'comercial',
    9,
    true
  ),
  (
    'Confidencialidad',
    'No compartir información interna de la empresa, precios de otros clientes, detalles de otros proyectos ni información del equipo sin autorización.',
    'legal',
    10,
    true
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE 4: email_processing_log (optional – audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_processing_log (
  id           SERIAL PRIMARY KEY,
  message_id   TEXT,
  event_type   TEXT NOT NULL,
  event_data   JSONB,
  error_msg    TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proc_log_message_id ON public.email_processing_log(message_id);
CREATE INDEX IF NOT EXISTS idx_proc_log_created_at ON public.email_processing_log(created_at DESC);

-- ============================================================
-- ROW-LEVEL SECURITY (Supabase)
-- Uncomment if using Supabase and need RLS
-- ============================================================
-- ALTER TABLE public.ai_email_drafts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ai_email_feedback_lessons ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.company_email_policies ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Service role full access on drafts"
--   ON public.ai_email_drafts FOR ALL
--   USING (auth.role() = 'service_role');
--
-- CREATE POLICY "Service role full access on lessons"
--   ON public.ai_email_feedback_lessons FOR ALL
--   USING (auth.role() = 'service_role');
--
-- CREATE POLICY "Service role full access on policies"
--   ON public.company_email_policies FOR ALL
--   USING (auth.role() = 'service_role');
