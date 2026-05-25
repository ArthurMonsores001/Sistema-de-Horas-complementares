'use client'

import { useEffect, useMemo, useState } from 'react'
import { ACTIVITIES, CATEGORIES, SELECTABLE_CATEGORIES } from '@/lib/data'
import { Certificate, CertificateAttachment } from '@/lib/types'
import { StoreType } from '@/hooks/useStore'
import { AlertTriangle, Calendar, Check, Clock, Download, Eye, ExternalLink, FileText, MapPin, MessageSquare, Pencil, Search, Send, Square, SquareCheck, Trash2, X } from 'lucide-react'
import { CertificateStatus } from '@/lib/types'

const CAT_STYLES = [
  { badge: 'bg-blue-50 text-blue-700', border: 'border-l-blue-400' },
  { badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-400' },
  { badge: 'bg-amber-50 text-amber-700', border: 'border-l-amber-400' },
  { badge: 'bg-violet-50 text-violet-700', border: 'border-l-violet-400' },
]

function formatDate(date: string) {
  if (!date) return 'Sem data'
  const [year, month, day] = date.split('-')
  return day && month && year ? `${day}/${month}/${year}` : date
}

const STATUS_CONFIG: Record<CertificateStatus, { label: string; className: string }> = {
  draft:    { label: 'Rascunho',           className: 'bg-gray-100 text-gray-500' },
  pending:  { label: 'Aguardando avaliação', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Aprovado',           className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Reprovado',          className: 'bg-red-50 text-red-700' },
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
          <div className="w-8 h-8 border-2 border-vinho-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
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
  const [pendingDelete, setPendingDelete] = useState<Certificate | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const usageById = store.getCertificateUsage()

  const submittableCerts = store.state.certificates.filter(
    c => c.status === 'draft' || c.status === 'rejected' || !c.status
  )

  const openSubmitModal = () => {
    setSelectedIds(new Set(submittableCerts.map(c => c.id)))
    setShowSubmitModal(true)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.size === submittableCerts.length
        ? new Set()
        : new Set(submittableCerts.map(c => c.id))
    )
  }

  const confirmSubmit = async () => {
    setSubmitting(true)
    const ok = await store.submitMultipleForReview(Array.from(selectedIds))
    setSubmitting(false)
    if (ok) setShowSubmitModal(false)
  }

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
    if (editing.status !== 'draft') return

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

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    await store.deleteCertificate(pendingDelete.id)
    setDeleting(false)
    setPendingDelete(null)
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
        {store.authUser && submittableCerts.length > 0 && (
          <button
            type="button"
            onClick={openSubmitModal}
            className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors flex-shrink-0"
          >
            <Send size={15} /> Enviar para avaliação
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por descrição, atividade ou instituição"
              className="w-full min-h-11 pl-9 pr-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
            />
          </label>

          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className="w-full min-h-11 px-3 rounded-lg border border-gray-200 text-sm bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
          >
            <option value="all">Todas as categorias</option>
            {SELECTABLE_CATEGORIES.map(category => (
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
            const certStatus = cert.status ?? 'draft'
            const statusCfg = STATUS_CONFIG[certStatus]

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
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
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

                    {certStatus === 'rejected' && cert.supervisorComment && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        <MessageSquare size={13} className="flex-shrink-0 mt-0.5" />
                        <span><strong>Comentário do avaliador:</strong> {cert.supervisorComment}</span>
                      </div>
                    )}
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
                    disabled={cert.status !== 'draft'}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-vinho-600 hover:border-vinho-200 hover:bg-vinho-50 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:border-gray-200 disabled:hover:bg-transparent"
                    aria-label="Editar certificado"
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingDelete(cert)}
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

      {showSubmitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Enviar para avaliação</h2>
                <p className="text-sm text-gray-500 mt-0.5">Selecione os certificados que deseja enviar ao avaliador.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm text-vinho-600 font-medium mb-3 hover:underline"
            >
              {selectedIds.size === submittableCerts.length
                ? <><SquareCheck size={16} /> Desmarcar todos</>
                : <><Square size={16} /> Selecionar todos</>
              }
            </button>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {submittableCerts.map(cert => {
                const { activity, style } = getCertificateMeta(cert)
                const checked = selectedIds.has(cert.id)
                return (
                  <button
                    key={cert.id}
                    type="button"
                    onClick={() => toggleSelect(cert.id)}
                    className={[
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                      checked
                        ? 'border-vinho-300 bg-vinho-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${checked ? 'bg-vinho-600' : 'border-2 border-gray-300'}`}>
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                    <div className={`w-7 h-7 rounded flex items-center justify-center text-sm flex-shrink-0 ${style.badge}`}>
                      {getCertificateMeta(cert).category.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{activity?.name ?? 'Atividade'}</p>
                      <p className="text-xs text-gray-500 truncate">{cert.description}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700 flex-shrink-0">{cert.hours}h</span>
                  </button>
                )
              })}
            </div>

            {store.apiError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{store.apiError}</p>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0 || submitting}
                onClick={confirmSubmit}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                  : <><Send size={15} /> Enviar {selectedIds.size} certificado{selectedIds.size !== 1 ? 's' : ''}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (() => {
        const { activity, category, style } = getCertificateMeta(pendingDelete)
        const usage = usageById[pendingDelete.id] ?? { effectiveHours: pendingDelete.hours, excessHours: 0 }

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl">
              <div className="border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-red-100 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                      <Trash2 size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Excluir certificado</h2>
                      <p className="mt-0.5 text-sm text-gray-500">
                        Esta ação remove o certificado da sua lista imediatamente.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !deleting && setPendingDelete(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/80 bg-white/70 text-gray-400 hover:bg-white hover:text-gray-700"
                    aria-label="Fechar alerta de exclusão"
                    disabled={deleting}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg ${style.badge}`}>
                      {category.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{activity?.name ?? 'Atividade'}</p>
                      <p className="mt-1 break-words text-sm text-gray-500">{pendingDelete.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600">
                          {usage.effectiveHours}h válidas
                        </span>
                        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600">
                          {formatDate(pendingDelete.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-gray-500">
                  Se este certificado já foi enviado para avaliação, ele precisará ser anexado novamente caso você queira reenviá-lo depois.
                </p>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingDelete(null)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    disabled={deleting}
                  >
                    {deleting
                      ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Excluindo...</>
                      : <><Trash2 size={15} /> Excluir agora</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
                  >
                    <option value="">Selecione a categoria...</option>
                    {SELECTABLE_CATEGORIES.map(category => (
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
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 disabled:opacity-50"
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
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
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
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Data</span>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={event => setEditField('date', event.target.value)}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Local / Instituição</span>
                  <input
                    value={editForm.location}
                    onChange={event => setEditField('location', event.target.value)}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
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
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors"
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

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-3 py-4 sm:px-4 sm:py-6">
            <div className="w-full max-w-4xl max-h-[94vh] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
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

              <div className="flex flex-col md:grid md:grid-cols-[1fr_260px] min-h-0 overflow-y-auto md:overflow-hidden flex-1">
                <div className="bg-slate-100 min-h-[300px] md:h-full md:overflow-hidden p-4 flex-shrink-0 md:flex-shrink">
                  {hasAttachment && viewing.attachment && (
                    <AttachmentPreview
                      attachment={viewing.attachment}
                      resolveAttachmentUrl={store.resolveAttachmentUrl}
                    />
                  )}

                  {!hasAttachment && (
                    <div className="h-full min-h-[300px] flex items-center justify-center text-center">
                      <div>
                        <FileText size={42} className="mx-auto text-slate-400 mb-3" />
                        <p className="text-sm font-semibold text-slate-700">Nenhum arquivo anexado</p>
                        <p className="text-xs text-slate-400 mt-1">Este certificado foi cadastrado sem arquivo ou manualmente.</p>
                      </div>
                    </div>
                  )}
                </div>

                <aside className="p-5 border-t md:border-t-0 md:border-l border-gray-100 space-y-5 md:overflow-y-auto">
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
                      <strong className={usage.excessHours > 0 ? 'text-red-600' : 'text-gray-400'}>{usage.excessHours}h</strong>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Avaliação</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-500">Status</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CONFIG[viewing.status ?? 'draft'].className}`}>
                          {STATUS_CONFIG[viewing.status ?? 'draft'].label}
                        </span>
                      </div>
                      {viewing.supervisorComment && (
                        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          <MessageSquare size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
                          <span>{viewing.supervisorComment}</span>
                        </div>
                      )}
                    </div>
                  </div>

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
                    <div className="grid grid-cols-2 gap-2">
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
                        className="inline-flex items-center justify-center gap-2 min-h-10 px-3 rounded-lg bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors"
                      >
                        <Download size={14} /> Baixar
                      </a>
                    </div>
                  )}

                  {viewing.extractedData?.text && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Texto extraído</div>
                      <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-500 font-mono leading-relaxed break-words">
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
