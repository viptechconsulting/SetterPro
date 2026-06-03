// Cliente server-side para Unipile API.
// ⚠️  Este módulo solo puede importarse en API Routes / Edge Functions / Server Actions.
// NUNCA lo importes en componentes del cliente.

import type {
  UnipileAccount,
  UnipileAccountProfile,
  UnipileHostedAuthResponse,
  UnipileMessage,
} from "@/types/unipile";

const API_URL = process.env.UNIPILE_API_URL ?? "https://api2.unipile.com:13465";
const API_KEY = process.env.UNIPILE_API_KEY;

function headers(): Record<string, string> {
  if (!API_KEY) throw new Error("UNIPILE_API_KEY no está configurada");
  return {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unipile ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function createHostedAuthUrl({
  workspaceId,
  appUrl,
}: {
  workspaceId: string;
  appUrl: string;
}): Promise<string> {
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const successUrl = `${appUrl}/callback/unipile?workspace_id=${workspaceId}&status=success`;
  const failureUrl = `${appUrl}/callback/unipile?workspace_id=${workspaceId}&status=failure`;
  const notifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/unipile-webhook`;

  const res = await fetch(`${API_URL}/api/v1/hosted/accounts/link`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "create",
      api_url: API_URL,
      expiresOn,
      providers: ["LINKEDIN"],
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
      notify_url: notifyUrl,
    }),
  });

  const data = await handleResponse<UnipileHostedAuthResponse>(res);
  return data.url;
}

export async function createReconnectUrl({
  unipileAccountId,
  workspaceId,
  appUrl,
}: {
  unipileAccountId: string;
  workspaceId: string;
  appUrl: string;
}): Promise<string> {
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const successUrl = `${appUrl}/callback/unipile?workspace_id=${workspaceId}&status=success&reconnect=true`;
  const failureUrl = `${appUrl}/callback/unipile?workspace_id=${workspaceId}&status=failure`;
  const notifyUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/unipile-webhook`;

  const res = await fetch(`${API_URL}/api/v1/hosted/accounts/link`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "reconnect",
      reconnect_account: unipileAccountId,
      api_url: API_URL,
      expiresOn,
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
      notify_url: notifyUrl,
    }),
  });

  const data = await handleResponse<UnipileHostedAuthResponse>(res);
  return data.url;
}

export async function getAccount(accountId: string): Promise<UnipileAccount> {
  const res = await fetch(`${API_URL}/api/v1/accounts/${accountId}`, {
    headers: headers(),
  });
  return handleResponse<UnipileAccount>(res);
}

export async function getAccountProfile(
  accountId: string
): Promise<UnipileAccountProfile> {
  const res = await fetch(`${API_URL}/api/v1/accounts/${accountId}/profile`, {
    headers: headers(),
  });
  return handleResponse<UnipileAccountProfile>(res);
}

export async function deleteAccount(accountId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/accounts/${accountId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Unipile DELETE ${res.status}: ${body}`);
  }
}

export async function getChatMessages(
  accountId: string,
  chatId: string,
  limit = 20
): Promise<{ role: "user" | "assistant"; content: string; sent_at: string }[]> {
  const res = await fetch(
    `${API_URL}/api/v1/chats/${chatId}/messages?account_id=${accountId}&limit=${limit}`,
    { headers: headers() }
  );
  const data = await handleResponse<{ items?: UnipileMessage[] }>(res);
  return (data.items ?? []).map((m) => ({
    role: m.is_sender ? "assistant" : "user",
    content: m.text ?? "",
    sent_at: m.timestamp ?? new Date().toISOString(),
  }));
}

export async function sendMessage(
  accountId: string,
  chatId: string,
  text: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/chats/${chatId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ account_id: accountId, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unipile sendMessage ${res.status}: ${body}`);
  }
}

export async function getProspectPosts(
  accountId: string,
  prospectId: string,
  limit = 5
): Promise<string[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/users/${prospectId}/posts?account_id=${accountId}&limit=${limit}`,
      { headers: headers() }
    );
    if (!res.ok) return [];
    const data = await res.json() as { items?: { text?: string }[] };
    return (data.items ?? [])
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!secret) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = signature.replace("sha256=", "");
    const sigBytes = new Uint8Array(
      (sig.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16))
    );
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}
