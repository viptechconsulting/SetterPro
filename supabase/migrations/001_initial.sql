-- ============================================================
-- SetterPro — Migración inicial
-- Incluye: workspaces, workspace_members, linkedin_accounts
-- con RLS estricto por workspace
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'trial'
                    CHECK (plan IN ('trial', 'starter', 'growth', 'agency')),
    trial_ends_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE workspace_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'owner'
                    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by      UUID REFERENCES auth.users(id),
    accepted_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- LINKEDIN ACCOUNTS
-- ============================================================
CREATE TABLE linkedin_accounts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Unipile (nunca almacenamos credenciales de LinkedIn)
    unipile_account_id      TEXT NOT NULL UNIQUE,

    -- Datos del perfil de LinkedIn (obtenidos via API de Unipile)
    linkedin_urn            TEXT,                   -- urn:li:member:XXXXX
    display_name            TEXT,
    headline                TEXT,
    avatar_url              TEXT,
    email                   TEXT,

    -- Estado de la conexión
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN (
                                'active',        -- conectada y funcionando
                                'disconnected',  -- sesión caducada, necesita reconexión
                                'suspended',     -- suspendida por LinkedIn
                                'rate_limited',  -- límite de invitaciones alcanzado
                                'reconnecting'   -- el usuario inició el flujo de reconexión
                            )),

    -- Control de invitaciones diarias
    daily_invite_limit      INT NOT NULL DEFAULT 80,
    invites_sent_today      INT NOT NULL DEFAULT 0,
    last_invite_reset       DATE,

    -- URL de reconexión pre-generada (se actualiza cuando la cuenta se desconecta)
    reconnect_url           TEXT,

    -- Timestamps
    connected_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_linkedin_accounts_workspace ON linkedin_accounts(workspace_id);
CREATE INDEX idx_linkedin_accounts_status ON linkedin_accounts(workspace_id, status);
CREATE INDEX idx_linkedin_accounts_unipile ON linkedin_accounts(unipile_account_id);

-- ============================================================
-- FUNCIÓN AUXILIAR: workspaces del usuario actual
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS UUID[] AS $$
    SELECT ARRAY(
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
          AND accepted_at IS NOT NULL
    )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_accounts  ENABLE ROW LEVEL SECURITY;

-- Workspaces: el usuario solo ve los que pertenece
CREATE POLICY "workspaces_isolation" ON workspaces
    FOR ALL
    USING (id = ANY(get_user_workspace_ids()));

-- Workspace members: ver miembros de mis workspaces
CREATE POLICY "members_read_own_workspace" ON workspace_members
    FOR SELECT
    USING (workspace_id = ANY(get_user_workspace_ids()));

-- Workspace members: gestionar mi propio registro
CREATE POLICY "members_manage_self" ON workspace_members
    FOR ALL
    USING (user_id = auth.uid());

-- LinkedIn accounts: aislamiento estricto por workspace
CREATE POLICY "linkedin_accounts_isolation" ON linkedin_accounts
    FOR ALL
    USING (workspace_id = ANY(get_user_workspace_ids()));

-- ============================================================
-- TRIGGER: auto-crear workspace al registrarse un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
    user_slug TEXT;
BEGIN
    -- Slug basado en el email (antes del @), sanitizado
    user_slug := LOWER(REGEXP_REPLACE(
        SPLIT_PART(NEW.email, '@', 1),
        '[^a-z0-9]', '-', 'g'
    )) || '-' || SUBSTRING(NEW.id::TEXT, 1, 8);

    -- Crear workspace personal
    INSERT INTO workspaces (name, slug)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        user_slug
    )
    RETURNING id INTO new_workspace_id;

    -- Agregar al usuario como owner
    INSERT INTO workspace_members (workspace_id, user_id, role, accepted_at)
    VALUES (new_workspace_id, NEW.id, 'owner', NOW());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER linkedin_accounts_updated_at
    BEFORE UPDATE ON linkedin_accounts
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
