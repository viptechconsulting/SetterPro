"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Phase = "loading" | "saving" | "success" | "error";

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const accountId   = params.get("account_id");
    const workspaceId = params.get("workspace_id");
    const status      = params.get("status");
    const isReconnect = params.get("reconnect") === "true";

    if (status === "failure") {
      setErrorMsg("La conexión fue cancelada o falló en LinkedIn.");
      setPhase("error");
      return;
    }

    if (!accountId || !workspaceId) {
      setErrorMsg("Parámetros inválidos en la URL de retorno.");
      setPhase("error");
      return;
    }

    async function save() {
      setPhase("saving");
      try {
        const res = await fetch("/api/linkedin/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            workspace_id: workspaceId,
            is_reconnect: isReconnect,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error ?? "No se pudo guardar la cuenta.");
          setPhase("error");
          return;
        }

        setPhase("success");
        setTimeout(() => router.push("/settings/accounts"), 2000);
      } catch {
        setErrorMsg("Error de red al guardar la cuenta.");
        setPhase("error");
      }
    }

    save();
  }, [params, router]);

  return (
    <div className="max-w-sm w-full text-center">
      {(phase === "loading" || phase === "saving") && (
        <div>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            {phase === "loading" ? "Verificando…" : "Guardando tu cuenta…"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">Procesando la conexión de LinkedIn. Un momento.</p>
        </div>
      )}

      {phase === "success" && (
        <div>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">¡Cuenta conectada!</h2>
          <p className="text-sm text-gray-500 mt-1">Tu cuenta de LinkedIn fue conectada exitosamente. Redirigiendo…</p>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Error al conectar</h2>
          <p className="text-sm text-gray-500 mt-1">{errorMsg}</p>
          <button
            onClick={() => router.push("/settings/accounts")}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Volver a cuentas
          </button>
        </div>
      )}
    </div>
  );
}

export default function UnipileCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={
        <div className="text-sm text-gray-400">Cargando…</div>
      }>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
