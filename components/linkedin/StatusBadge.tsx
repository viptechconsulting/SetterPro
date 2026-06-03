import { cn } from "@/lib/cn";
import type { LinkedInAccountStatus } from "@/types/database";

const CONFIG: Record<
  LinkedInAccountStatus,
  { label: string; dot: string; badge: string }
> = {
  active: {
    label: "Conectada",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  disconnected: {
    label: "Desconectada",
    dot: "bg-red-500 animate-pulse",
    badge: "bg-red-50 text-red-700 ring-red-600/20",
  },
  suspended: {
    label: "Suspendida",
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 ring-orange-600/20",
  },
  rate_limited: {
    label: "Límite alcanzado",
    dot: "bg-yellow-500",
    badge: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  },
  reconnecting: {
    label: "Reconectando...",
    dot: "bg-blue-500 animate-pulse",
    badge: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
};

interface StatusBadgeProps {
  status: LinkedInAccountStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, dot, badge } = CONFIG[status] ?? CONFIG.disconnected;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
