-- ============================================================
-- SetterPro — Migración 002: brains + setter_configs
-- ============================================================

-- ============================================================
-- CEREBRO IA
-- ============================================================
CREATE TABLE brains (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name                TEXT NOT NULL DEFAULT 'Principal',

    -- Qué vende
    product_description TEXT NOT NULL DEFAULT '',
    -- Ideal Customer Profile
    icp_description     TEXT NOT NULL DEFAULT '',
    -- Propuestas de valor (array de strings)
    value_propositions  JSONB NOT NULL DEFAULT '[]',
    -- Casos de éxito [{title, result, metric}]
    case_studies        JSONB NOT NULL DEFAULT '[]',
    -- FAQs [{question, answer}]
    faqs                JSONB NOT NULL DEFAULT '[]',
    -- Link de Calendly
    calendly_link       TEXT NOT NULL DEFAULT '',
    -- Contexto adicional libre
    additional_context  TEXT NOT NULL DEFAULT '',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);

-- ============================================================
-- CONFIGURACIÓN DEL SETTER
-- ============================================================
CREATE TABLE setter_configs (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brain_id                    UUID REFERENCES brains(id) ON DELETE SET NULL,

    name                        TEXT NOT NULL DEFAULT 'Alex',
    language                    TEXT NOT NULL DEFAULT 'es'
                                CHECK (language IN ('es', 'en', 'pt', 'fr')),
    tone                        TEXT NOT NULL DEFAULT 'professional'
                                CHECK (tone IN ('professional', 'casual', 'friendly', 'direct')),
    objective                   TEXT NOT NULL DEFAULT '',

    -- Preguntas de calificación [{order, question, key}]
    qualification_questions     JSONB NOT NULL DEFAULT '[]',
    -- Objeciones [{objection, response}]
    objection_handlers          JSONB NOT NULL DEFAULT '[]',
    -- Reglas de handoff [{trigger, action}]
    handoff_rules               JSONB NOT NULL DEFAULT '[]',

    min_messages_before_push    INT NOT NULL DEFAULT 3,
    opening_message             TEXT NOT NULL DEFAULT '',
    closing_message             TEXT NOT NULL DEFAULT '¡Perfecto! Te confirmo la reunión. ¡Hasta pronto!',
    is_default                  BOOLEAN NOT NULL DEFAULT FALSE,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_brains_workspace ON brains(workspace_id);
CREATE INDEX idx_setter_configs_workspace ON setter_configs(workspace_id);
CREATE INDEX idx_setter_configs_brain ON setter_configs(brain_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE brains         ENABLE ROW LEVEL SECURITY;
ALTER TABLE setter_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brains_isolation" ON brains
    FOR ALL USING (workspace_id = ANY(get_user_workspace_ids()));

CREATE POLICY "setter_configs_isolation" ON setter_configs
    FOR ALL USING (workspace_id = ANY(get_user_workspace_ids()));

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER brains_updated_at
    BEFORE UPDATE ON brains
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER setter_configs_updated_at
    BEFORE UPDATE ON setter_configs
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
