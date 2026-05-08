'use client'

import { ACTIVITIES, CATEGORIES } from '@/lib/data'
import { TabId } from '@/lib/types'
import { StoreType } from '@/hooks/useStore'
import { ArrowLeft, Award, Calendar, Clock, FileText, MapPin } from 'lucide-react'

interface CategoryDetailsProps {
  categoryId: number
  store: StoreType
  onNavigate: (tab: TabId) => void
}

const CAT_STYLES = [
  { fill: '#3b82f6', track: '#dbeafe', badge: 'bg-blue-50 text-blue-700', border: 'border-l-blue-400' },
  { fill: '#10b981', track: '#d1fae5', badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-400' },
  { fill: '#f59e0b', track: '#fef3c7', badge: 'bg-amber-50 text-amber-700', border: 'border-l-amber-400' },
  { fill: '#8b5cf6', track: '#ede9fe', badge: 'bg-violet-50 text-violet-700', border: 'border-l-violet-400' },
]

function formatDate(date: string) {
  if (!date) return 'Sem data'
  const [year, month, day] = date.split('-')
  return day && month && year ? `${day}/${month}/${year}` : date
}

export default function CategoryDetails({ categoryId, store, onNavigate }: CategoryDetailsProps) {
  const category = CATEGORIES[categoryId] ?? CATEGORIES[0]
  const style = CAT_STYLES[categoryId] ?? CAT_STYLES[0]
  const activities = ACTIVITIES.filter(activity => activity.categoryId === category.id)
  const categorySubmitted = activities.reduce((sum, activity) => sum + store.getActivitySubmitted(activity.id), 0)
  const categoryEffective = store.getCategoryEffective(category.id)
  const categoryMax = store.getCategoryMax(category.id)
  const pct = categoryMax > 0 ? Math.min(100, Math.round((categoryEffective / categoryMax) * 100)) : 0

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft size={16} /> Voltar ao dashboard
      </button>

      <section className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${style.border} p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3">
              <span className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl ${style.badge}`}>{category.icon}</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{category.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{category.shortName} · {activities.length} atividades possíveis</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-400">Enviadas</div>
              <div className="text-lg font-bold text-gray-900">{categorySubmitted}h</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-400">Válidas</div>
              <div className="text-lg font-bold text-emerald-600">{categoryEffective}h</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-400">Restante</div>
              <div className="text-lg font-bold text-indigo-600">{Math.max(0, categoryMax - categoryEffective)}h</div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Progresso da categoria</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: style.track }}>
            <div className="h-full rounded-full bar-animated" style={{ width: `${pct}%`, backgroundColor: style.fill }} />
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {activities.map(activity => {
          const submitted = store.getActivitySubmitted(activity.id)
          const effective = store.getActivityEffective(activity.id)
          const remaining = Math.max(0, activity.maxHours - effective)
          const activityPct = activity.maxHours > 0 ? Math.min(100, Math.round((effective / activity.maxHours) * 100)) : 0
          const certs = store.state.certificates
            .filter(cert => cert.activityId === activity.id)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

          return (
            <article key={activity.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900">{activity.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">Limite da atividade: {activity.maxHours}h</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center flex-shrink-0">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="text-[11px] text-gray-400">Enviado</div>
                    <div className="text-sm font-bold text-gray-900">{submitted}h</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="text-[11px] text-gray-400">Conta</div>
                    <div className="text-sm font-bold text-emerald-600">{effective}h</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <div className="text-[11px] text-gray-400">Ainda usa</div>
                    <div className="text-sm font-bold text-indigo-600">{remaining}h</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: style.track }}>
                <div className="h-full rounded-full bar-animated" style={{ width: `${activityPct}%`, backgroundColor: style.fill }} />
              </div>

              {certs.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {certs.map(cert => (
                    <div key={cert.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          <FileText size={14} className="text-indigo-500 flex-shrink-0" />
                          <span className="truncate">{cert.description}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1"><Clock size={12} /> {cert.hours}h</span>
                          <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(cert.date)}</span>
                          {cert.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {cert.location}</span>}
                        </div>
                      </div>
                      {cert.extractedData?.analysis && (
                        <span className={[
                          'inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0',
                          cert.extractedData.analysis.confidenceLabel === 'Alta' ? 'bg-emerald-50 text-emerald-700' :
                          cert.extractedData.analysis.confidenceLabel === 'Média' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
                        ].join(' ')}>
                          <Award size={12} /> {cert.extractedData.analysis.detectedTypeLabel}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                  Nenhum certificado vinculado a esta atividade.
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
