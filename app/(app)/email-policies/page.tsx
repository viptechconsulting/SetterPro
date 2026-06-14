import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listPolicies, listLessons } from '@/lib/email-drafts';
import { PolicyManager } from '@/components/email-drafts/PolicyManager';

export const dynamic = 'force-dynamic';

export default async function EmailPoliciesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [policies, lessons] = await Promise.all([
    listPolicies(),
    listLessons(10),
  ]);

  const activeCount   = policies.filter(p => p.active).length;
  const inactiveCount = policies.filter(p => !p.active).length;

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/email-drafts" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Volver a Email Drafts
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Políticas de Email</h1>
        <p className="text-gray-500 mt-1">
          Reglas que la IA sigue al redactar respuestas — {activeCount} activas, {inactiveCount} inactivas
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <span className="text-lg">ℹ️</span>
        <div>
          <p className="text-sm font-medium text-blue-800">Cómo funcionan las políticas</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Cada vez que un email nuevo entra, el workflow de n8n carga todas las políticas activas y las
            incluye en el prompt de OpenAI. Las políticas de menor número de prioridad se aplican primero.
            Los cambios aquí afectan el próximo email que se procese.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Policy manager */}
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Políticas</h2>
          <PolicyManager policies={policies} />
        </div>

        {/* Lessons sidebar */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Lecciones aprendidas</h2>
          <div className="space-y-3">
            {lessons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <p className="text-2xl mb-2">🧠</p>
                <p className="text-sm text-gray-500">Sin lecciones aún</p>
                <p className="text-xs text-gray-400 mt-1">
                  Las lecciones se generan cuando el equipo edita o rechaza drafts
                </p>
              </div>
            ) : (
              lessons.map(lesson => (
                <div key={lesson.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {lesson.situation_type && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 font-medium">
                        {lesson.situation_type}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(lesson.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{lesson.lesson}</p>
                  {lesson.from_email && (
                    <p className="text-xs text-gray-400 mt-2">{lesson.from_email}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
