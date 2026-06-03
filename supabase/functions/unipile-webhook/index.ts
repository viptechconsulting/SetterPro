// Supabase Edge Function: unipile-webhook
// Recibe eventos de Unipile sobre el estado de las cuentas de LinkedIn.
// URL: https://PROJECT.supabase.co/functions/v1/unipile-webhook
//
// Eventos manejados:
//   account.connected    → nueva cuenta conectada (del hosted auth notify_url)
//   account.disconnected → sesión expirada o revocada por LinkedIn
//   account.reconnected  → cuenta reconectada exitosamente

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UNIPILE_WEBHOOK_SECRET = Deno.env.get("UNIPILE_WEBHOOK_SECRET");
const UNIPILE_API_URL = Deno.env.get("UNIPILE_API_URL") ?? "https://api2.unipile.com:13465";
const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Verificación de firma HMAC-SHA256 ──────────────────────────────────────
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!UNIPILE_WEBHOOK_SECRET) {
    console.warn("UNIPILE_WEBHOOK_SECRET no configurado, saltando verificación");
    return true;
  }
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(UNIPILE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sig = signature.replace("sha256=", "");
    const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
  } catch {
    return false;
  }
}

// ── Obtener perfil de Unipile ──────────────────────────────────────────────
async function fetchProfile(accountId: string) {
  if (!UNIPILE_API_KEY) return null;
  try {
    const res = await fetch(`${UNIPILE_API_URL}/api/v1/accounts/${accountId}/profile`, {
      headers: { "X-API-KEY": UNIPILE_API_KEY, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Handler principal ──────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-unipile-signature") ?? "";

  // Verificar firma
  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    console.error("Firma de webhook inválida");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload.event as string;
  const accountId = payload.account_id as string;

  if (!accountId) {
    return new Response("account_id requerido", { status: 400 });
  }

  console.log(`[unipile-webhook] event=${event} account=${accountId}`);

  switch (event) {
    case "account.connected": {
      // El notify_url recibe esto cuando el wizard de hosted auth completa.
      // En este punto la cuenta ya se guardó via /api/linkedin/callback (flujo del usuario).
      // Aquí actualizamos por si hay datos más frescos o si el usuario cerró la ventana.
      const profile = await fetchProfile(accountId);

      const { error } = await supabase
        .from("linkedin_accounts")
        .update({
          status: "active",
          display_name: profile?.display_name ?? profile?.name ?? null,
          headline: profile?.headline ?? null,
          avatar_url: profile?.profile_picture_url ?? null,
          disconnected_at: null,
          reconnect_url: null,
        })
        .eq("unipile_account_id", accountId);

      if (error) {
        console.error("[account.connected] update error:", error);
      }
      break;
    }

    case "account.disconnected": {
      // La sesión de LinkedIn expiró o fue revocada. Marcar para reconexión.
      const { error } = await supabase
        .from("linkedin_accounts")
        .update({
          status: "disconnected",
          disconnected_at: new Date().toISOString(),
        })
        .eq("unipile_account_id", accountId);

      if (error) {
        console.error("[account.disconnected] update error:", error);
      }

      // Pausar campañas activas que usen esta cuenta
      await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("status", "active")
        .eq(
          "linkedin_account_id",
          // Sub-select para obtener el UUID interno de la cuenta
          supabase
            .from("linkedin_accounts")
            .select("id")
            .eq("unipile_account_id", accountId)
            .single()
        );

      break;
    }

    case "account.reconnected": {
      const { error } = await supabase
        .from("linkedin_accounts")
        .update({
          status: "active",
          disconnected_at: null,
          reconnect_url: null,
        })
        .eq("unipile_account_id", accountId);

      if (error) {
        console.error("[account.reconnected] update error:", error);
      }
      break;
    }

    case "account.error": {
      const message = payload.message as string | undefined;
      console.error(`[account.error] account=${accountId} message=${message}`);

      await supabase
        .from("linkedin_accounts")
        .update({ status: "suspended" })
        .eq("unipile_account_id", accountId);
      break;
    }

    default:
      // Eventos de mensajería y otros se manejarán en otras edge functions
      console.log(`[unipile-webhook] evento no manejado: ${event}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
