-- ============================================================
-- Migration 005: Email AI Draft System
-- VIP Tech Consulting internal email automation tables
-- No workspace isolation (n8n inserts directly without workspace context)
-- ============================================================

-- TABLE: ai_email_drafts
-- Every email processed + its AI-generated draft
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
  ai_risk_level           TEXT CHECK (ai_risk_level IN ('bajo', 'medio', 'alto', 'low', 'medium', 'high')),
  ai_suggested_reply      TEXT,
  ai_suggested_subject    TEXT,
  reasoning_for_human     TEXT,
  human_review_notes      JSONB DEFAULT '[]'::jsonb,
  status                  TEXT NOT NULL DEFAULT 'pending_review'
                            CHECK (status IN ('pending_review', 'approved', 'edited', 'rejected', 'sent', 'error')),
  approved_by             TEXT,
  approved_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  human_feedback          TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_status       ON public.ai_email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_from_email   ON public.ai_email_drafts(from_email);
CREATE INDEX IF NOT EXISTS idx_email_drafts_qb_customer  ON public.ai_email_drafts(quickbooks_customer_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at   ON public.ai_email_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_risk_level   ON public.ai_email_drafts(ai_risk_level);

-- Auto-update updated_at
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

-- TABLE: ai_email_feedback_lessons
-- Learning extracted from human edits/rejections
CREATE TABLE IF NOT EXISTS public.ai_email_feedback_lessons (
  id                      SERIAL PRIMARY KEY,
  draft_id                TEXT,
  quickbooks_customer_id  TEXT,
  from_email              TEXT,
  domain                  TEXT,
  situation_type          TEXT,
  original_ai_reply       TEXT,
  human_feedback          TEXT,
  revised_reply           TEXT,
  lesson                  TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_from_email    ON public.ai_email_feedback_lessons(from_email);
CREATE INDEX IF NOT EXISTS idx_lessons_domain        ON public.ai_email_feedback_lessons(domain);
CREATE INDEX IF NOT EXISTS idx_lessons_qb_customer   ON public.ai_email_feedback_lessons(quickbooks_customer_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_at    ON public.ai_email_feedback_lessons(created_at DESC);

-- TABLE: company_email_policies
-- Internal rules injected into every AI prompt
CREATE TABLE IF NOT EXISTS public.company_email_policies (
  id          SERIAL PRIMARY KEY,
  policy_name TEXT NOT NULL,
  policy_text TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  priority    INTEGER DEFAULT 1,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_email_policies_updated_at ON public.company_email_policies;
CREATE TRIGGER trg_email_policies_updated_at
  BEFORE UPDATE ON public.company_email_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TABLE: email_processing_log (audit trail)
CREATE TABLE IF NOT EXISTS public.email_processing_log (
  id          SERIAL PRIMARY KEY,
  message_id  TEXT,
  event_type  TEXT NOT NULL,
  event_data  JSONB DEFAULT '{}'::jsonb,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proc_log_message_id ON public.email_processing_log(message_id);
CREATE INDEX IF NOT EXISTS idx_proc_log_created_at ON public.email_processing_log(created_at DESC);

-- SEED: Default company policies
INSERT INTO public.company_email_policies (policy_name, policy_text, category, priority, active) VALUES
  ('No envío automático', 'Nunca enviar emails automáticamente sin aprobación humana. Todos los drafts requieren revisión antes de ser enviados.', 'operaciones', 1, true),
  ('Sin precios no aprobados', 'No proporcionar precios exactos si no existe una cotización aprobada formalmente por la gerencia.', 'comercial', 2, true),
  ('Sin compromisos de entrega sin validación', 'No prometer fechas de entrega ni plazos sin validar disponibilidad del equipo y aprobación del project manager.', 'operaciones', 3, true),
  ('Sin scope creep implícito', 'No aceptar trabajo fuera del scope del contrato como si estuviera incluido. Proponer revisión del alcance y cotización adicional.', 'comercial', 4, true),
  ('Cliente con balance vencido', 'Si el cliente tiene balance vencido, responder con cordialidad pero no comprometer nuevo trabajo hasta revisión administrativa.', 'financiero', 5, true),
  ('Cliente molesto – empatía sin admisión', 'Si el cliente expresa molestia, responder con empatía. No aceptar culpa legal ni financiera sin validación interna previa.', 'relaciones', 6, true),
  ('Tono profesional y orientado a soluciones', 'Mantener tono profesional, cercano, claro y orientado a soluciones. Comunicar siempre los próximos pasos.', 'comunicacion', 7, true),
  ('Protección comercial primero', 'Siempre proteger los intereses comerciales y legales de VIP Tech Consulting sin sacrificar la calidad del servicio.', 'legal', 8, true),
  ('Solicitudes de descuento', 'No ofrecer descuentos sin autorización de gerencia. Escalar internamente y comunicar que se evaluará.', 'comercial', 9, true),
  ('Confidencialidad', 'No compartir información interna, precios de otros clientes ni detalles de otros proyectos sin autorización.', 'legal', 10, true)
ON CONFLICT DO NOTHING;
