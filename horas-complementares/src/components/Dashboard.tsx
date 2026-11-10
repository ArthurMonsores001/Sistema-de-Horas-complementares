'use client'

import { CATEGORIES, ACTIVITIES } from '@/lib/data'
import { Certificate, TabId } from '@/lib/types'
import { StoreType } from '@/hooks/useStore'
import { TrendingUp, Clock, ChevronRight, Award, AlertTriangle } from 'lucide-react'

// ── Ring Progress (SVG) ─────────────────────────────────────────
function RingProgress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(1, max > 0 ? value / max : 0)
  const r = 58
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const complete = value >= max
  const pctLabel = Math.round(pct * 100)

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 160, height: 160 }}
      role="img"
      aria-label={`${value}h concluídas de ${max}h — ${pctLabel}%${complete ? ' — meta atingida' : ''}`}
    >
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="13" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke={complete ? '#10b981' : '#ffffff'}
          strokeWidth="13"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.25,1,0.5,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <div className="text-white font-extrabold text-3xl leading-none">{value}</div>
        <div className="text-white/50 text-xs font-medium mt-0.5">de {max}h</div>
        {complete && <div className="text-emerald-400 text-xs font-semibold mt-1">✓ Completo</div>}
      </div>
    </div>
  )
}

// ── Category Card ────────────────────────────────────────────────
interface CategoryCardProps {
  catIndex: number
  effective: number
  maxPossible: number
  onSelect: (categoryId: number) => void
}

const CAT_STYLE = { fill: '#660510', track: '#F7DFE2', badge: 'bg-vinho-50 text-vinho-700' }
const CAT_STYLES = [CAT_STYLE, CAT_STYLE, CAT_STYLE, CAT_STYLE]

function CategoryCard({ catIndex, effective, maxPossible, onSelect }: CategoryCardProps) {
  const cat = CATEGORIES[catIndex]
  const pct = maxPossible > 0 ? Math.min(100, Math.round((effective / maxPossible) * 100)) : 0

  return (
    <button
      type="button"
      onClick={() => onSelect(cat.id)}
      className="bg-white text-left rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:border-vinho-200 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xl">{cat.icon}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_STYLE.badge}`}>
          {pct}%
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{effective}h</div>
      <div className="text-xs font-medium text-gray-500 mb-3">{cat.shortName}</div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: CAT_STYLE.track }}>
        <div
          className="h-full rounded-full bar-animated"
          style={{ width: `${pct}%`, backgroundColor: CAT_STYLE.fill }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-2">de {maxPossible}h possíveis</div>
      <div className="text-xs text-gray-900 font-semibold mt-3 flex items-center gap-1">
        Ver detalhes <ChevronRight size={12} />
      </div>
    </button>
  )
}

// ── Horizontal Bar Chart ──────────────────────────────────────────
function HorizBar({ label, value, maxVal, color, track }: {
  label: string; value: number; maxVal: number; color: string; track: string
}) {
  const pct = maxVal > 0 ? Math.min(100, (value / maxVal) * 100) : 0
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{value}h</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: track }}>
        <div
          className="h-full rounded-full bar-animated"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── Activity Row ──────────────────────────────────────────────────
function ActivityRow({ actId, submitted, effective, maxH, color, track, name }: {
  actId: number; submitted: number; effective: number; maxH: number
  color: string; track: string; name: string
}) {
  const pct = Math.min(100, Math.round((effective / maxH) * 100))
  const exceeded = submitted > maxH

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-none">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
        {exceeded && (
          <span className="inline-block text-xs font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-0.5">
            Limite atingido
          </span>
        )}
      </div>
      <div className="w-24 hidden sm:block">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: track }}>
          <div className="h-full rounded-full bar-animated" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <div className="text-right flex-shrink-0 min-w-[72px]">
        <span className="text-sm font-bold text-gray-900">{effective}h</span>
        <span className="text-xs text-gray-400"> / {maxH}h</span>
      </div>
    </div>
  )
}

// ── Certificate Row ───────────────────────────────────────────────
function CertRow({ cert, onDelete }: { cert: Certificate; onDelete: (id: number) => void }) {
  const act = ACTIVITIES.find(a => a.id === cert.activityId)
  const cat = act ? CATEGORIES[act.categoryId] : CATEGORIES[0]
  const style = CAT_STYLES[act?.categoryId ?? 0]

  const fmtDate = (d: string) => {
    try {
      const [y, m, v] = d.split('-')
      return `${v}/${m}/${y}`
    } catch { return d }
  }

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${style.badge}`}>
        {cat.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{act?.name ?? 'Atividade'}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">
          {cert.description}{cert.location && ` · ${cert.location}`}{cert.date && ` · ${fmtDate(cert.date)}`}
        </div>
      </div>
      <div className="text-sm font-bold text-gray-900 flex-shrink-0">{cert.hours}h</div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────
interface DashboardProps {
  store: StoreType
  onNavigate: (tab: TabId) => void
  onCategorySelect: (categoryId: number) => void
}

export default function Dashboard({ store, onNavigate, onCategorySelect }: DashboardProps) {
  const { state, getTotalEffective, getCategoryEffective, getCategoryMax, getActivityEffective, getActivitySubmitted } = store

  const totalEff = getTotalEffective()
  const required = state.student.totalRequired || 180
  const pct = Math.min(100, Math.round((totalEff / required) * 100))
  const remaining = Math.max(0, required - totalEff)
  const name = state.student.name || null
  const firstName = name?.split(' ')[0] ?? null

  const MANDATORY_CATEGORY_IDS = [0, 1, 2, 3]
  const certUsage = store.getCertificateUsage()
  const missingCategories = MANDATORY_CATEGORY_IDS.filter(catId => {
    const actIds = ACTIVITIES.filter(a => a.categoryId === catId).map(a => a.id)
    return !state.certificates.some(
      c => actIds.includes(c.activityId) && (certUsage[c.id]?.effectiveHours ?? 0) > 0
    )
  })

  const actsWithHours = ACTIVITIES.filter(a => getActivitySubmitted(a.id) > 0)
  const recent = [...state.certificates].sort((a, b) => b.id - a.id).slice(0, 5)
  const maxCatEff = Math.max(1, ...CATEGORIES.map(c => getCategoryEffective(c.id)))

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Painel de Horas Complementares</h1>

      {/* First-run banner */}
      {!name && (
        <div className="flex items-center gap-4 bg-vinho-600 text-white rounded-xl px-5 py-4 shadow-md shadow-vinho-200">
          <Award size={28} className="flex-shrink-0 opacity-80" />
          <div className="flex-1">
            <div className="font-semibold text-sm">Bem-vindo(a)!</div>
            <div className="text-xs text-vinho-200 mt-0.5">Configure seu nome e matrícula para personalizar o app.</div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            Configurar <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Missing mandatory categories banner */}
      {missingCategories.length > 0 && (
        <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 sm:px-5 py-4">
          <AlertTriangle size={22} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Categorias obrigatórias incompletas</div>
            <div className="text-xs text-amber-700 mt-0.5 mb-2">
              Para validar suas horas você precisa de ao menos 1 certificado em cada área obrigatória. Faltando:
            </div>
            <div className="flex flex-wrap gap-2">
              {missingCategories.map(catId => (
                <span key={catId} className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                  {CATEGORIES[catId].icon} {CATEGORIES[catId].shortName}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigate('add')}
            className="w-full sm:w-auto flex-shrink-0 text-xs font-semibold bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-2 sm:py-1.5 rounded-lg transition-colors"
          >
            Adicionar certificado
          </button>
        </div>
      )}

      {/* Hero */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg shadow-vinho-900/20"
        style={{ background: 'linear-gradient(135deg, #330208 0%, #660510 50%, #53040D 100%)' }}
      >
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex-1">
              {firstName && (
                <div className="text-white/80 text-sm font-medium mb-1">
                  Olá, {firstName}! 👋
                </div>
              )}
              <div className="text-white font-bold text-xl sm:text-2xl mb-0.5">
                Progresso das Horas
              </div>
              <div className="text-white/80 text-sm mb-5">
                {state.student.course || 'Curso não informado'}{state.student.registration && ` · Matrícula ${state.student.registration}`}
              </div>

              {/* Progress bar */}
              <div className="bg-white/10 rounded-full h-3 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bar-animated"
                  style={{
                    width: `${pct}%`,
                    background: totalEff >= required
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/80">
                <span><span className="text-white font-bold">{totalEff}h</span> concluídas</span>
                <span className="font-semibold text-white/70">{pct}%</span>
                <span>
                  {remaining > 0
                    ? <><span className="text-white font-bold">{remaining}h</span> restantes</>
                    : <span className="text-emerald-400 font-semibold">✓ Meta atingida!</span>
                  }
                </span>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 mt-5">
                <div>
                  <div className="text-white/50 text-xs mb-0.5">Certificados</div>
                  <div className="text-white font-bold text-lg">{state.certificates.length}</div>
                </div>
                <div>
                  <div className="text-white/50 text-xs mb-0.5">Atividades</div>
                  <div className="text-white font-bold text-lg">{actsWithHours.length}</div>
                </div>
                <div>
                  <div className="text-white/50 text-xs mb-0.5">Meta</div>
                  <div className="text-white font-bold text-lg">{required}h</div>
                </div>
              </div>
            </div>

            {/* Ring */}
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <RingProgress value={totalEff} max={required} />
            </div>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {CATEGORIES.map((_, i) => (
          <CategoryCard
            key={i}
            catIndex={i}
            effective={getCategoryEffective(i)}
            maxPossible={getCategoryMax(i)}
            onSelect={onCategorySelect}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-gray-900" />
            <h2 className="text-sm font-semibold text-gray-700">Distribuição por Categoria</h2>
          </div>
          {CATEGORIES.map((cat, i) => (
            <HorizBar
              key={i}
              label={cat.shortName}
              value={getCategoryEffective(i)}
              maxVal={maxCatEff}
              color={CAT_STYLES[i].fill}
              track={CAT_STYLES[i].track}
            />
          ))}
        </div>

        {/* Activity breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-gray-900" />
            <h2 className="text-sm font-semibold text-gray-700">Atividades Registradas</h2>
          </div>
          {actsWithHours.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm text-gray-400">Adicione certificados para ver o detalhamento por atividade</p>
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {actsWithHours.map(act => (
                <ActivityRow
                  key={act.id}
                  actId={act.id}
                  submitted={getActivitySubmitted(act.id)}
                  effective={getActivityEffective(act.id)}
                  maxH={act.maxHours}
                  color={CAT_STYLES[act.categoryId].fill}
                  track={CAT_STYLES[act.categoryId].track}
                  name={act.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Certificates */}
      {recent.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-gray-900" />
              <h2 className="text-sm font-semibold text-gray-700">Adicionados Recentemente</h2>
            </div>
            <button
              onClick={() => onNavigate('certificates')}
              className="text-xs text-vinho-600 hover:text-vinho-800 font-medium flex items-center gap-1 transition-colors"
            >
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recent.map(cert => (
              <CertRow key={cert.id} cert={cert} onDelete={store.deleteCertificate} />
            ))}
          </div>
        </div>
      )}

      {/* Empty call-to-action */}
      {state.certificates.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-200 p-10 text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h2 className="text-gray-700 font-semibold text-base mb-1.5">Nenhum certificado ainda</h2>
          <p className="text-gray-400 text-sm mb-4">Adicione seus certificados para começar a acompanhar o progresso</p>
          <button
            onClick={() => onNavigate('add')}
            className="inline-flex items-center gap-2 bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm shadow-vinho-200"
          >
            Adicionar primeiro certificado
          </button>
        </div>
      )}
    </div>
  )
}
