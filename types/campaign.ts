export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type LeadStatus =
  | "queued" | "invite_sent" | "connected"
  | "first_message_sent" | "replied"
  | "calendly_sent" | "booked" | "disqualified" | "error";

export interface Campaign {
  id: string;
  workspace_id: string;
  setter_config_id: string | null;
  brain_id: string | null;
  name: string;
  status: CampaignStatus;
  search_url: string | null;
  search_params: Record<string, unknown> | null;
  invite_note_template: string | null;
  first_message_template: string;
  daily_cap: number;
  time_window_start: number;
  time_window_end: number;
  total_leads: number;
  invited_count: number;
  connected_count: number;
  replied_count: number;
  booked_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  prospect_unipile_id: string;
  prospect_name: string | null;
  prospect_headline: string | null;
  prospect_company: string | null;
  prospect_location: string | null;
  prospect_profile_url: string | null;
  status: LeadStatus;
  scheduled_at: string | null;
  invited_at: string | null;
  connected_at: string | null;
  first_message_scheduled_at: string | null;
  first_message_sent_at: string | null;
  conversation_id: string | null;
  error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  provider_id: string;
  first_name: string;
  last_name: string;
  headline: string | null;
  location: string | null;
  profile_url: string | null;
  company_name: string | null;
}

export interface CampaignCreatePayload {
  name: string;
  setter_config_id: string | null;
  brain_id: string | null;
  search_url: string;
  search_params: Record<string, unknown>;
  leads: SearchResult[];
  invite_note_template: string;
  first_message_template: string;
  daily_cap: number;
  time_window_start: number;
  time_window_end: number;
  account_ids: string[];
}
