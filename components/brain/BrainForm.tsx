"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { BrainData, CaseStudy, FAQ } from "@/types/brain";

const EMPTY_BRAIN: BrainData = {
  name: "Principal",
  product_description: "",
  icp_description: "",
  value_propositions: [""],
  case_studies: [],
  faqs: [],
  calendly_link: "",
  additional_context: "",
};

interface BrainFormProps {
  initial: BrainData | null;
}

export function BrainForm({ initial }: BrainFormProps) {
  const [data, setData] = useState<BrainData>(initial ?? EMPTY_BRAIN);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof BrainData>(key: K, value: BrainData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  // ── Value propositions ────────────────────────────────────────────────────
  function updateVP(i: number, val: string) {
    const next = [...data.value_propositions];
    next[i] = val;
    update("value_propositions", next);
  }
  function addVP() { update("value_propositions", [...data.value_propositions, ""]); }
  function removeVP(i: number) {
    update("value_propositions", data.value_propositions.filter((_, idx) => idx !== i));
  }

  // ── Case studies ─────────────────────────────────────────────────────────
  function updateCS(i: number, field: keyof CaseStudy, val: string) {
    const next = data.case_studies.map((cs, idx) => idx === i ? { ...cs, [field]: val } : cs);
    update("case_studies", next);
  }
  function addCS() { update("case_studies", [...data.case_studies, { title: "", result: "", metric: "" }]); }
  function removeCS(i: number) { update("case_studies", data.case_studies.filter((_, idx) => idx !== i)); }

  // ── FAQs ─────────────────────────────────────────────────────────────────
  function updateFAQ(i: number, field: keyof FAQ, val: string) {
    const next = data.faqs.map((f, idx) => idx === i ? { ...f, [field]: val } : f);
    update("faqs", next);
  }
  function addFAQ() { update("faqs", [...data.faqs, { question: "", answer: "" }]); }
  function removeFAQ(i: number) { update("faqs", data.faqs.filter((_, idx) => idx !== i)); }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brain", {
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

      {/* Qué vendés */}
      <Section title="¿Qué vendés?" subtitle="Describí tu producto o servicio con claridad. La IA usará esto para presentarlo.">
        <Textarea
          label="Descripción del producto / servicio"
          value={data.product_description}
          onChange={(v) => update("product_description", v)}
          placeholder="Ej: SaaS B2B que automatiza el outreach en LinkedIn con IA. Ayuda a founders y SDRs a generar reuniones sin hacer prospección manual..."
          rows={4}
        />
      </Section>

      {/* ICP */}
      <Section title="Cliente Ideal (ICP)" subtitle="¿A quién le vendés? Sé específico: industria, tamaño de empresa, cargo, dolor principal.">
        <Textarea
          label="Perfil del cliente ideal"
          value={data.icp_description}
          onChange={(v) => update("icp_description", v)}
          placeholder="Ej: Founders de SaaS B2B con 1-20 empleados, que venden a empresas medianas y necesitan generar pipeline. Cargo: CEO, Co-founder, Head of Sales..."
          rows={4}
        />
      </Section>

      {/* Propuestas de valor */}
      <Section title="Propuestas de valor" subtitle="Los beneficios concretos que le das al cliente. Una por línea.">
        <div className="space-y-2">
          {data.value_propositions.map((vp, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={vp}
                onChange={(e) => updateVP(i, e.target.value)}
                placeholder={`Ej: Generás 20+ reuniones al mes sin esfuerzo manual`}
                className={inputClass}
              />
              {data.value_propositions.length > 1 && (
                <button onClick={() => removeVP(i)} className={removeBtn}>✕</button>
              )}
            </div>
          ))}
          <AddButton onClick={addVP} label="+ Agregar propuesta" />
        </div>
      </Section>

      {/* Casos de éxito */}
      <Section title="Casos de éxito" subtitle="Resultados reales de clientes. La IA los usa para generar confianza.">
        <div className="space-y-3">
          {data.case_studies.map((cs, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">Caso {i + 1}</span>
                <button onClick={() => removeCS(i)} className={removeBtn}>✕</button>
              </div>
              <input type="text" value={cs.title} onChange={(e) => updateCS(i, "title", e.target.value)}
                placeholder="Nombre del cliente o empresa" className={inputClass} />
              <input type="text" value={cs.result} onChange={(e) => updateCS(i, "result", e.target.value)}
                placeholder="Resultado: ej: 35 reuniones en 30 días" className={inputClass} />
              <input type="text" value={cs.metric} onChange={(e) => updateCS(i, "metric", e.target.value)}
                placeholder="Métrica clave: ej: +300% de pipeline" className={inputClass} />
            </div>
          ))}
          <AddButton onClick={addCS} label="+ Agregar caso de éxito" />
        </div>
      </Section>

      {/* FAQs */}
      <Section title="Preguntas frecuentes" subtitle="Las preguntas que siempre hace el prospecto y sus respuestas ideales.">
        <div className="space-y-3">
          {data.faqs.map((faq, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-500">FAQ {i + 1}</span>
                <button onClick={() => removeFAQ(i)} className={removeBtn}>✕</button>
              </div>
              <input type="text" value={faq.question} onChange={(e) => updateFAQ(i, "question", e.target.value)}
                placeholder="¿Cuánto cuesta?" className={inputClass} />
              <Textarea label="" value={faq.answer} onChange={(v) => updateFAQ(i, "answer", v)}
                placeholder="Depende del plan, desde $X/mes..." rows={2} />
            </div>
          ))}
          <AddButton onClick={addFAQ} label="+ Agregar FAQ" />
        </div>
      </Section>

      {/* Calendly */}
      <Section title="Link de Calendly" subtitle="El setter va a enviar este link cuando el prospecto esté listo para agendar.">
        <Input
          label="URL de Calendly"
          value={data.calendly_link}
          onChange={(v) => update("calendly_link", v)}
          placeholder="https://calendly.com/tu-usuario/demo-30min"
          type="url"
        />
      </Section>

      {/* Contexto adicional */}
      <Section title="Contexto adicional" subtitle="Cualquier otra cosa que la IA deba saber: precios, procesos, restricciones, etc.">
        <Textarea
          label=""
          value={data.additional_context}
          onChange={(v) => update("additional_context", v)}
          placeholder="Ej: No vendemos a empresas de menos de 5 empleados. El proceso de venta dura 2 semanas..."
          rows={3}
        />
      </Section>

      {/* Guardar */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar Cerebro IA"}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Guardado</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

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

function Input({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(inputClass, "resize-none")}
      />
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1">
      {label}
    </button>
  );
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const removeBtn = "flex-shrink-0 h-8 w-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 text-xs transition-colors";
