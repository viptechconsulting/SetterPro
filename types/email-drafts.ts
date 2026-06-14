export type DraftStatus = 'pending_review' | 'approved' | 'edited' | 'rejected' | 'sent' | 'error';
export type RiskLevel = 'bajo' | 'medio' | 'alto';

export interface EmailDraft {
  id: number;
  message_id: string;
  thread_id: string | null;
  draft_id: string | null;
  quickbooks_customer_id: string | null;
  from_email: string;
  customer_name: string | null;
  company_name: string | null;
  original_subject: string | null;
  original_body: string | null;
  ai_case_summary: string | null;
  ai_risk_level: RiskLevel | null;
  ai_suggested_reply: string | null;
  ai_suggested_subject: string | null;
  reasoning_for_human: string | null;
  human_review_notes: string[];
  status: DraftStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  human_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailDraftStats {
  pending: number;
  approved: number;
  edited: number;
  rejected: number;
  total_today: number;
  high_risk: number;
}

export interface FeedbackLesson {
  id: number;
  draft_id: string | null;
  quickbooks_customer_id: string | null;
  from_email: string | null;
  domain: string | null;
  situation_type: string | null;
  original_ai_reply: string | null;
  human_feedback: string | null;
  revised_reply: string | null;
  lesson: string | null;
  created_at: string;
}

export interface CompanyPolicy {
  id: number;
  policy_name: string;
  policy_text: string;
  category: string;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateDraftPayload {
  status?: DraftStatus;
  rejection_reason?: string;
  human_feedback?: string;
  approved_by?: string;
}
