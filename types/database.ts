// Tipos de la DB. Regenerar con `npm run db:types` una vez conectado a Supabase.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type LinkedInAccountStatus =
  | "active"
  | "disconnected"
  | "suspended"
  | "rate_limited"
  | "reconnecting";

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: "trial" | "starter" | "growth" | "agency";
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: "trial" | "starter" | "growth" | "agency";
          trial_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          plan?: "trial" | "starter" | "growth" | "agency";
          trial_ends_at?: string | null;
          updated_at?: string;
        };
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member" | "viewer";
          invited_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member" | "viewer";
          invited_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          role?: "owner" | "admin" | "member" | "viewer";
          accepted_at?: string | null;
        };
      };
      linkedin_accounts: {
        Row: {
          id: string;
          workspace_id: string;
          unipile_account_id: string;
          linkedin_urn: string | null;
          display_name: string | null;
          headline: string | null;
          avatar_url: string | null;
          email: string | null;
          status: LinkedInAccountStatus;
          daily_invite_limit: number;
          invites_sent_today: number;
          last_invite_reset: string | null;
          reconnect_url: string | null;
          connected_at: string;
          disconnected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          unipile_account_id: string;
          linkedin_urn?: string | null;
          display_name?: string | null;
          headline?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          status?: LinkedInAccountStatus;
          daily_invite_limit?: number;
          invites_sent_today?: number;
          last_invite_reset?: string | null;
          reconnect_url?: string | null;
          connected_at?: string;
          disconnected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          linkedin_urn?: string | null;
          display_name?: string | null;
          headline?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          status?: LinkedInAccountStatus;
          daily_invite_limit?: number;
          invites_sent_today?: number;
          last_invite_reset?: string | null;
          reconnect_url?: string | null;
          disconnected_at?: string | null;
          updated_at?: string;
        };
      };
    };
    Functions: {
      get_user_workspace_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Workspace = Tables<"workspaces">;
export type WorkspaceMember = Tables<"workspace_members">;

// LinkedInAccount con tipos Insert/Update anidados para conveniencia en API routes
export type LinkedInAccount = Tables<"linkedin_accounts"> & {
  Insert: Database["public"]["Tables"]["linkedin_accounts"]["Insert"];
  Update: Database["public"]["Tables"]["linkedin_accounts"]["Update"];
};

// Tipos de resultado explícitos para queries comunes
export type MembershipRow = Pick<WorkspaceMember, "workspace_id" | "role">;
export type WorkspaceNameRow = Pick<Workspace, "id" | "name">;
