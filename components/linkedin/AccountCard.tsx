"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/cn";
import type { LinkedInAccount } from "@/types/database";

interface AccountCardProps {
  account: LinkedInAccount;
}

export function AccountCard({ account }: AccountCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReconnect =
    account.status === "disconnected" || account.status === "suspended";

  const isRateLimited = account.status === "rate_limited";

  async function handleReconnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_account_id: account.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Error al generar URL de reconexión");
        return;
      }

      // Redirigir al wizard de Unipile
      window.location.href = data.url;
    } catch {
      setError("Error de red, intenta nuevamente");
    } finally {
      setLoading(false);
    }
  }

  const invitePercent = Math.min(
    100,
    Math.round((account.invites_sent_today / account.daily_invite_limit) * 100)
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        needsReconnect && "border-red-200 bg-red-50/30",
        isRateLimited && "border-yellow-200 bg-yellow-50/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {account.avatar_url ? (
            <Image
              src={account.avatar_url}
              alt={account.display_name ?? "LinkedIn"}
              width={44}
              height={44}
              className="rounded-full ring-2 ring-white shadow"
            />
          ) : (
            <div className="h-11 w-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg">
              {(account.display_name ?? "?")[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">
              {account.display_name ?? "Cuenta de LinkedIn"}
            </p>
            {account.headline && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                {account.headline}
              </p>
            )}
            {account.email && (
              <p className="text-xs text-gray-400 mt-0.5">{account.email}</p>
            )}
          </div>
        </div>
        <StatusBadge status={account.status} />
      </div>

      {/* Alerta de reconexión */}
      {needsReconnect && (
        <div className="mt-4 rounded-lg bg-red-100 border border-red-200 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            {account.status === "suspended"
              ? "⚠️ Esta cuenta fue suspendida por LinkedIn."
              : "🔌 Esta cuenta necesita reconexión."}
          </p>
          <p className="text-xs text-red-600 mt-1">
            {account.status === "suspended"
              ? "Revisa tu cuenta de LinkedIn directamente. Es posible que LinkedIn haya detectado actividad inusual."
              : "La sesión expiró o fue revocada. Reconecta para continuar las campañas."}
          </p>
          {account.disconnected_at && (
            <p className="text-xs text-red-400 mt-1">
              Desconectada:{" "}
              {new Date(account.disconnected_at).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      )}

      {/* Alerta de rate limit */}
      {isRateLimited && (
        <div className="mt-4 rounded-lg bg-yellow-100 border border-yellow-200 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800">
            ⏱️ Límite de invitaciones diarias alcanzado
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Las campañas continuarán automáticamente mañana.
          </p>
        </div>
      )}

      {/* Barra de progreso de invitaciones */}
      {account.status === "active" && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-gray-500">Invitaciones hoy</span>
            <span className="text-xs font-medium text-gray-700">
              {account.invites_sent_today} / {account.daily_invite_limit}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                invitePercent >= 90
                  ? "bg-red-400"
                  : invitePercent >= 70
                  ? "bg-yellow-400"
                  : "bg-emerald-400"
              )}
              style={{ width: `${invitePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Acciones */}
      <div className="mt-4 flex items-center gap-2">
        {needsReconnect && account.status !== "suspended" && (
          <button
            onClick={handleReconnect}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Generando enlace..." : "Reconectar cuenta"}
          </button>
        )}
        {account.status === "reconnecting" && account.reconnect_url && (
          <a
            href={account.reconnect_url}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 text-center transition-colors"
          >
            Continuar reconexión →
          </a>
        )}
        {account.status === "active" && (
          <button
            onClick={() => router.push(`/settings/accounts/${account.id}`)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Configurar
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          ID: {account.unipile_account_id.slice(0, 8)}…
        </span>
      </div>
    </div>
  );
}
