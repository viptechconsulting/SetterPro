-- Add unipile_chat_id and unipile_account_id to campaign_leads
-- These are needed to send the first message after a connection is accepted.
ALTER TABLE campaign_leads
  ADD COLUMN IF NOT EXISTS unipile_chat_id    TEXT,
  ADD COLUMN IF NOT EXISTS unipile_account_id TEXT;
