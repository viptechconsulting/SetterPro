"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { SetterConfigData, QualificationQuestion, ObjectionHandler, HandoffRule } from "@/types/brain";

const EMPTY_SETTER: SetterConfigData = {
  name: "Alex",
  language: "es",
  tone: "professional",
  objective: "",
  qualification_questions: [],
  objection_handlers: [],
  handoff_rules: [],
  min_messages_before_push: 3,
  opening_message: "",
  closing_message: "¡Perfecto! Te confirmo la reunión. ¡Hasta pronto!",
};

interface SetterFormProps {
  initial: SetterConfigData | null;
}

export function SetterForm({ initial }: SetterFormProps) {
  const [data, setData] = useState<SetterConfigData>(initial ?? EMPTY_SETTER);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof SetterConfigData>(key: K, value: SetterConfigData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  // ── Qualification questions ───────────────────────────────────────────────
  function updateQQ(i: number, field: keyof QualificationQuestion, val: string | number) {
    const next = data.qualification_questions.map((q, idx) => idx === i ? { ...q, [field]: val } : q);
    update("qualification_questions", next);
  }
  function addQQ() {
    const order = data.qualification_questions.length + 1;
    update("qualification_questions", [...data.qualification_questions, { order, question: "", key: "" }]);
  }
  function removeQQ(i: number) {
    const next = data.qualification_questions.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, order: idx + 1 }));
    update("qualification_questions", next);
  }

  // ── Objection handlers ────────────────────────────────────────────────────
  function updateOH(i: number, field: keyof ObjectionHandler, val: string) {
    const next = data.objection_handlers.map((o, idx) => idx === i ? { ...o, [field]: val } : o);
    update("objection_handlers", next);
  }
  function addOH() { update("objection_handlers", [...data.objection_handlers, { objection: "", response: "" }]); }
  function removeOH(i: number) { update("objection_handlers", data.objection_handlers.filter((_, idx) => idx !== i)); }

  // ── Handoff rules ─────────────────────────────────────────────────────────
  function updateHR(i: number, field: keyof HandoffRule, val: string) {
    const next = data.handoff_rules.map((h, idx) => idx === i ? { ...h, [field]: val } : h);
    update("handoff_rules", next);
  }
  function addHR() { update("handoff_rules", [...data.handoff_rules, { trigger: "", action: "pause_ai" }]); }
  function removeHR(i: number) { update("handoff_rules", data.handoff_rules.filter((_, idx) => idx !== i)); }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error al guardar"); return; }
      setSaved(true);
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Identidad */}
      <Section title="Identidad del Setter" subtitle="Cómo se presenta la IA al prospecto.">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre del setter" value={data.name} onChange={(v) => update("name", v)} placeholder="Alex" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Idioma</label>
            <select value={data.language} onChange={(e) => update("language", e.target.value as SetterConfigData["language"])} className={selectClass}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tono de comunicación</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["professional", "casual", "friendly", "direct"] as const).map((t) => (
              <button
                key={t}
                onClick={() => update("tone", t)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  data.tone === t
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                )}
              >
                {t === "professional" ? "Profesional" : t === "casual" ? "Casual" : t === "friendly" ? "Amigable" : "Directo"}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Objetivo */}
      <Section title="Objetivo de la conversación" subtitle="Qué tiene que lograr el setter en cada charla.">
        <Textarea
          label="Objetivo principal"
          value={data.objective}
          onChange={(v) => update("objective", v)}
          placeholder="Ej: Calificar al prospecto y agendar una demo de 30 minutos con el founder."
          rows={3}
        />
      </Section>

      {/* Mensajes */}
      <Section title="Mensajes clave" subtitle="El primer y último mensaje que envía el setter.">
        <div className="space-y-4">
          <Textarea
            label="Mensaje de apertura"
            value={data.opening_message}
            onChange={(v) => update("opening_message", v)}
            placeholder="Ej: Hola [nombre], vi que conectamos en LinkedIn. Te escribo porque ayudamos a founders de SaaS B2B a generar más reuniones de ventas sin esfuerzo manual. ¿Te gustaría saber cómo funciona?"
            rows={3}
          />
          <Textarea
            label="Mensaje de cierre"
            value={data.closing_message}
            onChange={(v) => update("closing_message", v)}
            placeholder="Ej: ¡Perfecto! Te confirmo la reunión. ¡Hasta pronto!"
            rows={2}
          />
        </div>
      </Section>

      {/* Preguntas de calificación */}
      <Section title="Preguntas de calificación" subtitle="Las preguntas que hace el setter para entender si el prospecto califica.">
        <div className="space-y-3">
          {data.qualification_questions.map((qq, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">Pregunta {qq.order}</span>
                <button onClick={() => removeQQ(i)} className={removeBtn}>✕</button>
              </div>
              <input
                type="text" value={qq.question} onChange={(e) => updateQQ(i, "question", e.target.value)}
                placeholder="¿Cuántas personas tiene tu equipo de ventas?" className={inputClass}
              />
              <input
                type="text" value={qq.key} onChange={(e) => updateQQ(i, "key", e.target.value)}
                placeholder="Clave interna (ej: team_size)" className={cn(inputClass, "font-mono text-xs")}
              />
            </div>
          ))}
          <AddButton onClick={addQQ} label="+ Agregar pregunta" />
        </div>
      </Section>

      {/* Objeciones */}
      <Section title="Manejo de objeciones" subtitle="Respuestas preparadas para las objeciones más comunes.">
        <div className="space-y-3">
          {data.objection_handlers.map((oh, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">Objeción {i + 1}</span>
                <button onClick={() => removeOH(i)} className={removeBtn}>✕</button>
              </div>
              <input type="text" value={oh.objection} onChange={(e) => updateOH(i, "objection", e.target.value)}
                placeholder="Ej: No tengo tiempo ahora" className={inputClass} />
              <Textarea label="" value={oh.response} onChange={(v) => updateOH(i, "response", v)}
                placeholder="Ej: Entiendo perfectamente. La demo dura solo 20 minutos y te mostramos exactamente cómo recuperar ese tiempo..." rows={2} />
            </div>
          ))}
          <AddButton onClick={addOH} label="+ Agregar objeción" />
        </div>
      </Section>

      {/* Handoff rules */}
      <Section title="Reglas de handoff" subtitle="Cuándo el setter debe pausarse y pasarte el chat a vos.">
        <div className="space-y-3">
          {data.handoff_rules.map((hr, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">Regla {i + 1}</span>
                <button onClick={() => removeHR(i)} className={removeBtn}>✕</button>
              </div>
              <input type="text" value={hr.trigger} onChange={(e) => updateHR(i, "trigger", e.target.value)}
                placeholder="Ej: El prospecto pregunta por precio específico" className={inputClass} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Acción</label>
                <select value={hr.action} onChange={(e) => updateHR(i, "action", e.target.value as HandoffRule["action"])} className={selectClass}>
                  <option value="pause_ai">Pausar IA y notificarme</option>
                  <option value="continue">Continuar con IA</option>
                </select>
              </div>
            </div>
          ))}
          <AddButton onClick={addHR} label="+ Agregar regla" />
        </div>
      </Section>

      {/* Min messages */}
      <Section title="Mensajes mínimos antes de proponer reunión" subtitle="Cuántos mensajes debe intercambiar antes de mencionar el Calendly.">
        <div className="flex items-center gap-3">
          <input
            type="number" min={1} max={20} value={data.min_messages_before_push}
            onChange={(e) => update("min_messages_before_push", parseInt(e.target.value) || 1)}
            className={cn(inputClass, "w-24 text-center")}
          />
          <span className="text-sm text-gray-500">mensajes</span>
        </div>
      </Section>

      {/* Guardar */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar Configuración"}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Guardado</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className={cn(inputClass, "resize-none")} />
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">
      {label}
    </button>
  );
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const removeBtn = "flex-shrink-0 h-8 w-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 text-xs transition-colors";
