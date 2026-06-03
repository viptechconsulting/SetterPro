-- ============================================================
-- SetterPro — Migración 003: conversations + pending_ai_replies
-- ============================================================

-- ============================================================
-- CONVERSACIONES
-- ============================================================
CREATE TYPE lead_status AS ENUM ('active', 'calendly_sent', 'booked', 'disqualified');

CREATE TABLE conversations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    linkedin_account_id     UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,

    -- IDs de Unipile
    unipile_chat_id         TEXT NOT NULL,
    unipile_account_id      TEXT NOT NULL,
    prospect_unipile_id     TEXT NOT NULL,

    -- Datos del prospecto (snapshot)
    prospect_name           TEXT,
    prospect_headline       TEXT,

    -- Estado
    ai_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    lead_status             lead_status NOT NULL DEFAULT 'active',

    -- Contexto de calificación (respuestas del prospecto)
    qualification_data      JSONB NOT NULL DEFAULT '{}',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(workspace_id, unipile_chat_id)
);

-- ============================================================
-- MENSAJES (historial local para no re-pedir a Unipile)
-- ============================================================
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COLA DE RESPUESTAS PENDIENTES (delay humano)
-- ============================================================
CREATE TABLE pending_ai_replies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    process_after       TIMESTAMPTZ NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'done', 'failed')),
    error               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_chat_id ON conversations(unipile_chat_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sent_at);
CREATE INDEX idx_pending_replies_status ON pending_ai_replies(status, process_after)
    WHERE status = 'pending';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_ai_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_isolation" ON conversations
    FOR ALL USING (workspace_id = ANY(get_user_workspace_ids()));

CREATE POLICY "messages_isolation" ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE workspace_id = ANY(get_user_workspace_ids())
        )
    );

CREATE POLICY "pending_replies_isolation" ON pending_ai_replies
    FOR ALL USING (workspace_id = ANY(get_user_workspace_ids()));

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
