'use client'

import { useEffect, useMemo, useState } from 'react'
import { ACTIVITIES, CATEGORIES } from '@/lib/data'
import { Certificate, CertificateAttachment } from '@/lib/types'
import { StoreType } from '@/hooks/useStore'
import { AlertTriangle, Calendar, Check, Clock, Download, Eye, ExternalLink, FileText, MapPin, Pencil, Search, Trash2, X } from 'lucide-react'

const CAT_STYLES = [
  { badge: 'bg-blue-50 text-blue-700', border: 'border-l-blue-400' },
  { badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-400' },
  { badge: 'bg-amber-50 text-amber-700', border: 'border-l-amber-400' },
  { badge: 'bg-violet-50 text-violet-700', border: 'border-l-violet-400' },
  { badge: 'bg-pink-50 text-pink-700', border: 'border-l-pink-400' },
]

function formatDate(date: string) {
  if (!date) return 'Sem data'
  const [year, month, day] = date.split('-')
  return day && month && year ? `${day}/${month}/${year}` : date
}

function getCertificateMeta(cert: Certificate) {
  const activity = ACTIVITIES.find(a => a.id === cert.activityId)
  const category = activity ? CATEGORIES[activity.categoryId] : CATEGORIES[0]
  const style = CAT_STYLES[activity?.categoryId ?? 0]

  return { activity, category, style }
}

interface CertificatesProps {
  store: StoreType
}

interface EditForm {
  categoryId: string
  activityId: string
  description: string
  hours: string
  date: string
  location: string
}

function toEditForm(cert: Certificate): EditForm {
  const activity = ACTIVITIES.find(item => item.id === cert.activityId)
  return {
    categoryId: activity ? String(activity.categoryId) : '',
    activityId: String(cert.activityId),
    description: cert.description,
    hours: String(cert.hours),
    date: cert.date,
    location: cert.location,
  }
}

function AttachmentPreview({
  attachment,
  resolveAttachmentUrl,
}: {
  attachment: CertificateAttachment
  resolveAttachmentUrl: StoreType['resolveAttachmentUrl']
}) {
  const [objectUrl, setObjectUrl] = useState('')
  const [error, setError] = useState('')
  const isImage = attachment.type.startsWith('image/')
  const isPdf = attachment.type === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf')

  useEffect(() => {
    let revokedUrl = ''
    let cancelled = false
    setError('')
    setObjectUrl('')

    const loadAttachment = async () => {
      try {
        if (attachment.storagePath) {
          const signedUrl = await resolveAttachmentUrl(attachment.storagePath)
          if (!cancelled) setObjectUrl(signedUrl)
          return
        }

        if (!attachment.dataUrl) return

        if (isImage) {
          setObjectUrl(attachment.dataUrl)
          return
        }

        const response = await fetch(attachment.dataUrl)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        revokedUrl = url
        if (!cancelled) setObjectUrl(url)
      } catch {
        if (!cancelled) setError('Não foi possível preparar a pré-visualização do arquivo.')
      }
    }

    loadAttachment()

    return () => {
      cancelled = true
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [attachment.dataUrl, attachment.storagePath, isImage, resolveAttachmentUrl])

  if (error) {
    return (
      <div className="h-full min-h-[420px] flex items-center justify-center text-center">
        <div>
          <FileText size={42} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-semibold text-slate-700">{error}</p>
          <p className="text-xs text-slate-400 mt-1">{attachment.name}</p>
        </div>
      </div>
    )
  }

  if (!objectUrl) {
    return (
      <div className="h-full min-h-[420px] flex items-center justify-center text-center">
        <div>
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Carregando arquivo...</p>
        </div>
      </div>
    )
  }

  if (isPdf) {
    return (
      <object
        data={`${objectUrl}#toolbar=1&navpanes=0`}
        type="application/pdf"
        className="w-full h-full min-h-[520px] rounded-lg border border-slate-200 bg-white"
      >
        <embed
          src={`${objectUrl}#toolbar=1&navpanes=0`}
          type="application/pdf"
          className="w-full h-full min-h-[520px] rounded-lg border border-slate-200 bg-white"
        />
      </object>
    )
  }

  if (isImage) {
    return (
      <div className="w-full h-full min-h-[520px] flex items-center justify-center">
        <img
          src={objectUrl}
          alt={`Certificado ${attachment.name}`}
          className="max-w-full max-h-full rounded-lg object-contain shadow-sm"
        />
      </div>
    )
  }

  return (
    <div className="h-full min-h-[420px] flex items-center justify-center text-center">
      <div>
        <FileText size={42} className="mx-auto text-slate-400 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Pré-visualização indisponível</p>
        <p className="text-xs text-slate-400 mt-1">{attachment.name}</p>
      </div>
    </div>
  )
}

export default function Certificates({ store }: CertificatesProps) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [viewing, setViewing] = useState<Certificate | null>(null)
  const usageById = store.getCertificateUsage()

  const startEdit = (cert: Certificate) => {
    setEditing(cert)
    setEditForm(toEditForm(cert))
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm(null)
  }

  const setEditField = (field: keyof EditForm, value: string) => {
    setEditForm(prev => {
      if (!prev) return prev
      if (field === 'categoryId') {
        return { ...prev, categoryId: value, activityId: '' }
      }
      return { ...prev, [field]: value }
    })
  }

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing || !editForm) return

    const activityId = Number(editForm.activityId)
    const hours = Number(editForm.hours)
    if (!activityId || !hours || hours < 1) return

    store.updateCertificate(editing.id, {
      ...editing,
      activityId,
      description: editForm.description.trim(),
      hours,
      date: editForm.date,
      location: editForm.location.trim(),
    })
    closeEdit()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...store.state.certificates]
      .sort((a, b) => b.id - a.id)
      .filter(cert => {
        const { activity, category } = getCertificateMeta(cert)
        const matchesCategory = categoryFilter === 'all' || activity?.categoryId === Number(categoryFilter)
        const haystack = [cert.description, cert.location, activity?.name, category.name].join(' ').toLowerCase()
        return matchesCategory && (!q || haystack.includes(q))
      })
  }, [categoryFilter, query, store.state.certificates])

  const totalSubmitted = store.state.certificates.reduce((sum, cert) => sum + cert.hours, 0)
  const totalEffective = store.getTotalEffective()
  const totalExcess = Math.max(0, totalSubmitted - totalEffective)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Certificados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {store.state.certificates.length} registros · {totalEffective}h válidas · {totalExcess}h excedentes
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por descrição, atividade ou instituição"
              className="w-full min-h-11 pl-9 pr-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className="w-full min-h-11 px-3 rounded-lg border border-gray-200 text-sm bg-white text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Todas as categorias</option>
            {CATEGORIES.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-gray-200 p-10 text-center">
          <div className="text-4xl mb-3">📄</div>
          <h3 className="text-gray-700 font-semibold text-base mb-1.5">Nenhum certificado encontrado</h3>
          <p className="text-gray-400 text-sm">Ajuste os filtros ou adicione um novo certificado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(cert => {
            const { activity, category, style } = getCertificateMeta(cert)
            const usage = usageById[cert.id] ?? { effectiveHours: cert.hours, excessHours: 0 }
            const hasExcess = usage.excessHours > 0

            return (
              <article
                key={cert.id}
                className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${style.border} p-4`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${style.badge}`}>
                    {category.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900">{activity?.name ?? 'Atividade'}</h2>
                        <p className="text-sm text-gray-500 mt-0.5 break-words">{cert.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900">{usage.effectiveHours}h válidas</span>
                        {hasExcess && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                            <AlertTriangle size={12} /> +{usage.excessHours}h não contam
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} /> {cert.hours}h enviadas
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={13} /> {formatDate(cert.date)}
                      </span>
                      {cert.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} /> {cert.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewing(cert)}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 flex items-center justify-center transition-colors flex-shrink-0"
                    aria-label="Visualizar certificado"
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(cert)}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 flex items-center justify-center transition-colors flex-shrink-0"
                    aria-label="Editar certificado"
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Excluir este certificado?')) {
                        store.deleteCertificate(cert.id)
                      }
                    }}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0"
                    aria-label="Excluir certificado"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Editar certificado</h2>
                <p className="text-sm text-gray-500 mt-0.5">Ajuste os dados e salve para recalcular o dashboard.</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                aria-label="Fechar edição"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Categoria</span>
                  <select
                    required
                    value={editForm.categoryId}
                    onChange={event => setEditField('categoryId', event.target.value)}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Selecione a categoria...</option>
                    {CATEGORIES.map(category => (
                      <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Atividade</span>
                  <select
                    required
                    value={editForm.activityId}
                    onChange={event => setEditField('activityId', event.target.value)}
                    disabled={!editForm.categoryId}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                  >
                    <option value="">
                      {editForm.categoryId ? 'Selecione a atividade...' : 'Selecione a categoria primeiro'}
                    </option>
                    {ACTIVITIES
                      .filter(activity => activity.categoryId === Number(editForm.categoryId))
                      .map(activity => (
                        <option key={activity.id} value={activity.id}>
                          {activity.name} (máx. {activity.maxHours}h)
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Descrição / Nome do Curso</span>
                <input
                  required
                  value={editForm.description}
                  onChange={event => setEditField('description', event.target.value)}
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Horas</span>
                  <input
                    required
                    type="number"
                    min="1"
                    max="9999"
                    value={editForm.hours}
                    onChange={event => setEditField('hours', event.target.value)}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Data</span>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={event => setEditField('date', event.target.value)}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Local / Instituição</span>
                  <input
                    value={editForm.location}
                    onChange={event => setEditField('location', event.target.value)}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  <X size={15} /> Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                >
                  <Check size={15} /> Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (() => {
        const { activity, category } = getCertificateMeta(viewing)
        const usage = usageById[viewing.id] ?? { effectiveHours: viewing.hours, excessHours: 0 }
        const hasAttachment = Boolean(viewing.attachment?.dataUrl || viewing.attachment?.storagePath)
        const analysis = viewing.extractedData?.analysis
        const suggestedActivity = analysis?.suggestedActivityId
          ? ACTIVITIES.find(item => item.id === analysis.suggestedActivityId)
          : null
        const suggestedCategory = analysis?.suggestedCategoryId !== undefined
          ? CATEGORIES[analysis.suggestedCategoryId]
          : null
        const validSignals = [
          { label: 'Arquivo anexado', ok: hasAttachment },
          { label: 'Atividade selecionada', ok: Boolean(activity) },
          { label: 'Horas informadas', ok: viewing.hours > 0 },
          { label: 'Dentro do limite da atividade', ok: usage.excessHours === 0 },
          { label: 'Classificação automática', ok: Boolean(analysis && !analysis.needsReview) },
        ]

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6">
            <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">Visualizar certificado</h2>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {activity?.name ?? 'Atividade'} · {category.shortName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
                  aria-label="Fechar visualização"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0 overflow-y-auto lg:overflow-hidden">
                <div className="bg-slate-100 min-h-[420px] lg:min-h-0 lg:h-[calc(92vh-73px)] p-4">
                  {hasAttachment && viewing.attachment && (
                    <AttachmentPreview
                      attachment={viewing.attachment}
                      resolveAttachmentUrl={store.resolveAttachmentUrl}
                    />
                  )}

                  {!hasAttachment && (
                    <div className="h-full min-h-[420px] flex items-center justify-center text-center">
                      <div>
                        <FileText size={42} className="mx-auto text-slate-400 mb-3" />
                        <p className="text-sm font-semibold text-slate-700">Nenhum arquivo anexado</p>
                        <p className="text-xs text-slate-400 mt-1">Este certificado foi cadastrado antes da visualização de arquivos ou manualmente.</p>
                      </div>
                    </div>
                  )}
                </div>

                <aside className="p-5 border-t lg:border-t-0 lg:border-l border-gray-100 space-y-5">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Conferência</div>
                    <div className="space-y-2">
                      {validSignals.map(signal => (
                        <div key={signal.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-600">{signal.label}</span>
                          <span className={[
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                            signal.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
                          ].join(' ')}>
                            {signal.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
                            {signal.ok ? 'Ok' : 'Revisar'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Horas enviadas</span>
                      <strong className="text-gray-900">{viewing.hours}h</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Horas válidas</span>
                      <strong className="text-emerald-700">{usage.effectiveHours}h</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">Excedentes</span>
                      <strong className={usage.excessHours > 0 ? 'text-red-600' : 'text-gray-900'}>{usage.excessHours}h</strong>
                    </div>
                  </div>

                  {analysis && (
                    <div className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Classificação sugerida</div>
                        <span className={[
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          analysis.confidenceLabel === 'Alta' ? 'bg-emerald-50 text-emerald-700' :
                          analysis.confidenceLabel === 'Média' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
                        ].join(' ')}>
                          {analysis.confidenceLabel} · {Math.round(analysis.confidence * 100)}%
                        </span>
                      </div>

                      <dl className="space-y-2 text-sm">
                        <div>
                          <dt className="text-gray-400">Tipo detectado</dt>
                          <dd className="font-semibold text-gray-800">{analysis.detectedTypeLabel}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">Categoria sugerida</dt>
                          <dd className="font-semibold text-gray-800">{suggestedCategory?.name ?? 'Não identificada'}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">Atividade sugerida</dt>
                          <dd className="font-semibold text-gray-800">{suggestedActivity?.name ?? 'Não identificada'}</dd>
                        </div>
                      </dl>

                      {analysis.needsReview && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                          <span>Classificação com confiança limitada. Revise categoria e atividade antes de validar.</span>
                        </div>
                      )}

                      {analysis.matchedKeywords.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-400 mb-2">Palavras encontradas</div>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.matchedKeywords.map(keyword => (
                              <span key={keyword} className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.evidence.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-gray-400 mb-2">Evidências</div>
                          <ul className="space-y-1 text-xs text-gray-500">
                            {analysis.evidence.map(item => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Dados cadastrados</div>
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-gray-400">Descrição</dt>
                        <dd className="font-medium text-gray-800 break-words">{viewing.description}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">Data</dt>
                        <dd className="font-medium text-gray-800">{formatDate(viewing.date)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">Instituição</dt>
                        <dd className="font-medium text-gray-800 break-words">{viewing.location || 'Não informada'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-400">Arquivo</dt>
                        <dd className="font-medium text-gray-800 break-words">{viewing.attachment?.name ?? 'Não anexado'}</dd>
                      </div>
                    </dl>
                  </div>

                  {viewing.attachment?.dataUrl && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={viewing.attachment.dataUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-10 px-3 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink size={14} /> Abrir
                      </a>
                      <a
                        href={viewing.attachment.dataUrl}
                        download={viewing.attachment.name}
                        className="inline-flex items-center justify-center gap-2 min-h-10 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                      >
                        <Download size={14} /> Baixar
                      </a>
                    </div>
                  )}

                  {viewing.extractedData?.text && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Texto extraído</div>
                      <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-500 font-mono leading-relaxed break-words">
                        {viewing.extractedData.text}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
