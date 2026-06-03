import Link from "next/link";
import { cn } from "@/lib/cn";

interface Step {
  label: string;
  description: string;
  href: string;
  done: boolean;
  cta: string;
}

interface Props {
  hasLinkedIn: boolean;
  hasBrain: boolean;
  hasSetter: boolean;
  hasCampaign: boolean;
}

export function OnboardingChecklist({ hasLinkedIn, hasBrain, hasSetter, hasCampaign }: Props) {
  const steps: Step[] = [
    {
      label: "Conectá tu LinkedIn",
      description: "Conectá tu cuenta para que el setter pueda enviar mensajes.",
      href: "/settings/accounts",
      done: hasLinkedIn,
      cta: "Conectar",
    },
    {
      label: "Cargá el Cerebro IA",
      description: "Enseñale a la IA qué vendés, a quién y cómo convencer.",
      href: "/settings/brain",
      done: hasBrain,
      cta: "Cargar",
    },
    {
      label: "Configurá tu Setter",
      description: "Definí nombre, tono, preguntas de calificación y handoff.",
      href: "/settings/setter",
      done: hasSetter,
      cta: "Configurar",
    },
    {
      label: "Creá tu primera campaña",
      description: "Pegá una URL de búsqueda de LinkedIn y lanzá el outreach.",
      href: "/campaigns/new",
      done: hasCampaign,
      cta: "Crear campaña",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;

  if (allDone) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Primeros pasos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{completed} de {steps.length} completados</p>
        </div>
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div key={i} className={cn("h-2 w-8 rounded-full", s.done ? "bg-blue-600" : "bg-blue-200")} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {steps.map((step, i) => (
          <div key={i} className={cn(
            "rounded-lg border p-3 flex items-center gap-3",
            step.done ? "bg-white border-gray-200 opacity-60" : "bg-white border-blue-200"
          )}>
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              step.done ? "bg-emerald-500 text-white" : "bg-blue-100 text-blue-700"
            )}>
              {step.done ? "✓" : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{step.label}</p>
              <p className="text-xs text-gray-500 truncate">{step.description}</p>
            </div>
            {!step.done && (
              <Link href={step.href}
                className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700">
                {step.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
