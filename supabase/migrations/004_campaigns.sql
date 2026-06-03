-- ============================================================
-- SetterPro — Migración 004: campaigns + campaign_leads
-- ============================================================

CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');

CREATE TYPE lead_status AS ENUM (
  'queued', 'invite_sent', 'connected',
  'first_message_sent', 'replied',
  'calendly_sent', 'booked', 'disqualified', 'error'
);

CREATE TABLE campaigns (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    setter_config_id            UUID REFERENCES setter_configs(id) ON DELETE SET NULL,
    brain_id                    UUID REFERENCES brains(id) ON DELETE SET NULL,

    name                        TEXT NOT NULL,
    status                      campaign_status NOT NULL DEFAULT 'draft',

    -- Search source
    search_url                  TEXT,
    search_params               JSONB,

    -- Messaging
    invite_note_template        TEXT,   -- ≤300 chars, null = no note
    first_message_template      TEXT NOT NULL DEFAULT '',

    -- Schedule
    daily_cap                   INT NOT NULL DEFAULT 30,
    time_window_start           INT NOT NULL DEFAULT 9,   -- hour 0-23
    time_window_end             INT NOT NULL DEFAULT 18,  -- hour 0-23

    -- Stats (denormalized for speed)
    total_leads                 INT NOT NULL DEFAULT 0,
    invited_count               INT NOT NULL DEFAULT 0,
    connected_count             INT NOT NULL DEFAULT 0,
    replied_count               INT NOT NULL DEFAULT 0,
    booked_count                INT NOT NULL DEFAULT 0,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE campaign_leads (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id                 UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    linkedin_account_id         UUID REFERENCES linkedin_accounts(id) ON DELETE SET NULL,

    -- Prospect data (snapshot from search)
    prospect_unipile_id         TEXT NOT NULL,
    prospect_name               TEXT,
    prospect_headline           TEXT,
    prospect_company            TEXT,
    prospect_location           TEXT,
    prospect_profile_url        TEXT,

    -- State machine
    status                      lead_status NOT NULL DEFAULT 'queued',
    scheduled_at                TIMESTAMPTZ,
    invited_at                  TIMESTAMPTZ,
    connected_at                TIMESTAMPTZ,
    first_message_sent_at       TIMESTAMPTZ,
    first_message_scheduled_at  TIMESTAMPTZ,

    error                       TEXT,
    retry_count                 INT NOT NULL DEFAULT 0,

    -- Link to conversation once they reply
    conversation_id             UUID REFERENCES conversations(id) ON DELETE SET NULL,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(campaign_id, prospect_unipile_id)
);

-- Pool of LinkedIn accounts for a campaign
CREATE TABLE campaign_linkedin_accounts (
    campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, linkedin_account_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_workspace ON campaign_leads(workspace_id);
CREATE INDEX idx_campaign_leads_scheduled ON campaign_leads(status, scheduled_at)
    WHERE status = 'queued';
CREATE INDEX idx_campaign_leads_first_msg ON campaign_leads(status, first_message_scheduled_at)
    WHERE status = 'connected';
CREATE INDEX idx_campaign_leads_prospect ON campaign_leads(prospect_unipile_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE campaigns                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_linkedin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_isolation" ON campaigns
    FOR ALL USING (workspace_id = ANY(get_user_workspace_ids()));

CREATE POLICY "campaign_leads_isolation" ON campaign_leads
    FOR ALL USING (workspace_id = ANY(get_user_workspace_ids()));

CREATE POLICY "campaign_linkedin_accounts_isolation" ON campaign_linkedin_accounts
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id = ANY(get_user_workspace_ids())
        )
    );

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER campaign_leads_updated_at
    BEFORE UPDATE ON campaign_leads
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
