import type { DraftStatus, RiskLevel } from '@/types/email-drafts';

const STATUS_STYLES: Record<DraftStatus, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  approved:       'bg-green-100 text-green-800',
  edited:         'bg-blue-100 text-blue-800',
  rejected:       'bg-red-100 text-red-800',
  sent:           'bg-gray-100 text-gray-800',
  error:          'bg-red-100 text-red-800',
};

const STATUS_LABEL: Record<DraftStatus, string> = {
  pending_review: 'Pendiente',
  approved:       'Aprobado',
  edited:         'Editado',
  rejected:       'Rechazado',
  sent:           'Enviado',
  error:          'Error',
};

const RISK_STYLES: Record<string, string> = {
  bajo:   'bg-green-100 text-green-800',
  medio:  'bg-yellow-100 text-yellow-800',
  alto:   'bg-red-100 text-red-800',
  low:    'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high:   'bg-red-100 text-red-800',
};

const RISK_LABEL: Record<string, string> = {
  bajo: 'Riesgo bajo', medio: 'Riesgo medio', alto: 'Riesgo alto',
  low: 'Riesgo bajo', medium: 'Riesgo medio', high: 'Riesgo alto',
};

export function DraftStatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel | null }) {
  if (!risk) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_STYLES[risk] ?? 'bg-gray-100 text-gray-800'}`}>
      {RISK_LABEL[risk] ?? risk}
    </span>
  );
}
