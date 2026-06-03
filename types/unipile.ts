// Tipos de respuesta de la API de Unipile

export interface UnipileHostedAuthResponse {
  url: string; // URL del wizard de autenticación
}

export interface UnipileAccount {
  id: string;
  name: string;
  type: string; // "LINKEDIN"
  connection_params?: {
    mail?: string;
    [key: string]: unknown;
  };
  created_at?: string;
  updated_at?: string;
}

export interface UnipileAccountProfile {
  account_id: string;
  provider: string;
  id: string; // linkedin URN o ID del perfil
  display_name?: string;
  headline?: string;
  profile_picture_url?: string;
  email?: string;
}

// Eventos de webhook que Unipile puede enviar
export type UnipileWebhookEvent =
  | "account.connected"
  | "account.disconnected"
  | "account.reconnected"
  | "account.error"
  | "messaging.new_message"
  | "messaging.new_relation";

export interface UnipileWebhookPayload {
  event: UnipileWebhookEvent;
  account_id: string;
  provider?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface UnipileError {
  error: string;
  message: string;
  status: number;
}
