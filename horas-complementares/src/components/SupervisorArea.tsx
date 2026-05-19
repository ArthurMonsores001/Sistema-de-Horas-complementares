'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { StoreType } from '@/hooks/useStore'
import { fetchAllStudentsForSupervisor, reviewCertificate, getAttachmentUrl } from '@/lib/api'
import { StudentProfile, Certificate, CertificateStatus } from '@/lib/types'
import { ACTIVITIES, CATEGORIES } from '@/lib/data'
import LogoutConfirmModal from '@/components/LogoutConfirmModal'
import {
  ShieldCheck, LogOut, Search, Users, Clock, RefreshCw, ChevronRight,
  GraduationCap, ArrowLeft, CheckCircle2, XCircle, FileText, ExternalLink,
  MessageSquare, Save, Eye, Pencil,
} from 'lucide-react'

interface SupervisorAreaProps {
  store: StoreType
}

type FilterTab = 'all' | 'pending'

interface EvalState {
  decision: 'approved' | 'rejected' | null
  comment: string
  saving: boolean
  done: boolean
  editing: boolean
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<CertificateStatus, string> = {
  draft: 'Rascunho',
  pending: 'Aguardando',
  approved: 'Aprovado',
  rejected: 'Reprovado',
}
const STATUS_COLOR: Record<CertificateStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status?: CertificateStatus }) {
  const s = status ?? 'draft'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[s]}`}>
      {STATUS_LABEL[s]}
    </span>
  )
}

// ── Student evaluation view ───────────────────────────────────────────────────
function StudentEvalView({
  profile,
  onBack,
  onProfileUpdate,
}: {
  profile: StudentProfile
  onBack: () => void
  onProfileUpdate: (reg: string, certId: number, status: 'approved' | 'rejected', comment: string) => void
}) {
  const [evalMap, setEvalMap] = useState<Record<number, EvalState>>({})
  const [loadingUrl, setLoadingUrl] = useState<number | null>(null)

  const pending = useMemo(() => profile.certificates.filter(c => c.status === 'pending'), [profile])
  const evaluated = useMemo(
    () => profile.certificates.filter(c => c.status === 'approved' || c.status === 'rejected'),
    [profile],
  )

  const getEval = (id: number): EvalState =>
    evalMap[id] ?? { decision: null, comment: '', saving: false, done: false, editing: false }

  const setEval = (id: number, patch: Partial<EvalState>) =>
    setEvalMap(prev => ({ ...prev, [id]: { ...getEval(id), ...patch } }))

  const handleSave = async (cert: Certificate) => {
    const ev = getEval(cert.id)
    if (!ev.decision) return
    if (ev.decision === 'rejected' && !ev.comment.trim()) return

    setEval(cert.id, { saving: true })
    try {
      await reviewCertificate(cert.id, ev.decision, ev.comment.trim() || undefined)
      setEval(cert.id, { saving: false, done: true, editing: false })
      onProfileUpdate(profile.registration, cert.id, ev.decision, ev.comment.trim())
    } catch {
      setEval(cert.id, { saving: false })
    }
  }

  const handleViewFile = async (cert: Certificate) => {
    if (!cert.attachment?.storagePath) return
    setLoadingUrl(cert.id)
    try {
      const signedUrl = await getAttachmentUrl(cert.attachment.storagePath)
      const response = await fetch(signedUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const tab = window.open(blobUrl, '_blank')
      // revoke after the browser has had time to load the content
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      if (!tab) window.location.href = blobUrl
    } finally {
      setLoadingUrl(null)
    }
  }

  const activityName = (actId: number) => ACTIVITIES.find(a => a.id === actId)?.name ?? `Atividade #${actId}`
  const categoryName = (actId: number) => {
    const act = ACTIVITIES.find(a => a.id === actId)
    return act ? (CATEGORIES.find(c => c.id === act.categoryId)?.shortName ?? '') : ''
  }

  const renderCert = (cert: Certificate, editable: boolean) => {
    const ev = getEval(cert.id)
    const isDone = ev.done
    const effectiveStatus = isDone ? ev.decision as CertificateStatus : cert.status

    return (
      <div key={cert.id} className={[
        'bg-white rounded-xl border shadow-sm px-4 py-4 transition-all',
        isDone ? 'border-green-200 bg-green-50/30' : 'border-gray-100',
      ].join(' ')}>
        {/* Cert header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm leading-snug">{activityName(cert.activityId)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{categoryName(cert.activityId)}</p>
          </div>
          <StatusBadge status={effectiveStatus} />
        </div>

        {/* Cert details */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          <span className="text-xs text-gray-500"><span className="font-medium">{cert.hours}h</span> declaradas</span>
          {cert.date && <span className="text-xs text-gray-500">Data: <span className="font-medium">{cert.date}</span></span>}
          {cert.location && <span className="text-xs text-gray-500">Local: <span className="font-medium">{cert.location}</span></span>}
        </div>
        {cert.description && (
          <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">{cert.description}</p>
        )}

        {/* File button */}
        {cert.attachment?.storagePath && (
          <button
            onClick={() => handleViewFile(cert)}
            disabled={loadingUrl === cert.id}
            className="inline-flex items-center gap-1.5 text-xs text-vinho-600 hover:text-vinho-800 font-medium mb-3 transition-colors disabled:opacity-50"
          >
            {loadingUrl === cert.id
              ? <span className="w-3 h-3 border border-vinho-500 border-t-transparent rounded-full animate-spin" />
              : <ExternalLink size={13} />}
            Visualizar arquivo
          </button>
        )}

        {/* Evaluated: show comment + alter button */}
        {!editable && !ev.editing && (
          <>
            {cert.supervisorComment && (
              <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2 mt-1 mb-2">
                <MessageSquare size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-600">{cert.supervisorComment}</p>
              </div>
            )}
            <div className="border-t border-gray-100 mt-3 pt-3">
              <button
                onClick={() => setEval(cert.id, {
                  editing: true,
                  decision: cert.status as 'approved' | 'rejected',
                  comment: cert.supervisorComment ?? '',
                  done: false,
                })}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-vinho-600 font-medium transition-colors"
              >
                <Pencil size={12} />
                Alterar avaliação
              </button>
            </div>
          </>
        )}

        {/* Evaluation controls (pending OR editing evaluated) */}
        {(editable || ev.editing) && !isDone && (
          <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
            {/* Decision buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setEval(cert.id, { decision: 'approved' })}
                className={['flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold border transition-colors',
                  ev.decision === 'approved'
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-300'].join(' ')}
              >
                <CheckCircle2 size={15} />
                Aprovado
              </button>
              <button
                onClick={() => setEval(cert.id, { decision: 'rejected' })}
                className={['flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold border transition-colors',
                  ev.decision === 'rejected'
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-300'].join(' ')}
              >
                <XCircle size={15} />
                Reprovado
              </button>
            </div>

            {/* Comment */}
            {ev.decision && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Comentário{ev.decision === 'rejected' ? ' (obrigatório)' : ' (opcional)'}
                </label>
                <textarea
                  value={ev.comment}
                  onChange={e => setEval(cert.id, { comment: e.target.value })}
                  placeholder={ev.decision === 'rejected' ? 'Explique o motivo da reprovação...' : 'Observação para o aluno...'}
                  rows={2}
                  className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                />
              </div>
            )}

            {/* Save / Cancel buttons */}
            {ev.decision && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(cert)}
                  disabled={ev.saving || (ev.decision === 'rejected' && !ev.comment.trim())}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {ev.saving
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Save size={14} />}
                  Salvar
                </button>
                {ev.editing && (
                  <button
                    onClick={() => setEval(cert.id, { editing: false, decision: null, comment: '', done: false })}
                    className="px-4 h-9 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Done indicator */}
        {isDone && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600 mt-1">
            <CheckCircle2 size={15} />
            Avaliação salva
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700 truncate">{profile.student.name || 'Aluno'}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Student info card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-vinho-100 flex items-center justify-center flex-shrink-0">
              <span className="text-vinho-600 font-bold">
                {profile.student.name.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-bold text-gray-800">{profile.student.name || '(sem nome)'}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                <span className="text-xs text-gray-400">Mat.: <span className="text-gray-600">{profile.student.registration}</span></span>
                <span className="text-xs text-gray-400">Curso: <span className="text-gray-600">
                  {profile.student.course}{profile.student.engineeringType ? ` · ${profile.student.engineeringType}` : ''}
                </span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending certificates */}
        {pending.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-vinho-700 flex items-center gap-1.5 mb-3">
              <Clock size={15} />
              Aguardando avaliação ({pending.length})
            </h2>
            <div className="flex flex-col gap-3">
              {pending.map(cert => renderCert(cert, true))}
            </div>
          </section>
        )}

        {/* Evaluated certificates */}
        {evaluated.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 flex items-center gap-1.5 mb-3">
              <Eye size={15} />
              Já avaliados ({evaluated.length})
            </h2>
            <div className="flex flex-col gap-3">
              {evaluated.map(cert => renderCert(cert, false))}
            </div>
          </section>
        )}

        {profile.certificates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <FileText size={28} className="text-gray-300" />
            <p className="text-sm text-gray-400">Este aluno não possui certificados.</p>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Main SupervisorArea ───────────────────────────────────────────────────────
export default function SupervisorArea({ store }: SupervisorAreaProps) {
  const [profiles, setProfiles] = useState<StudentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [selectedProfile, setSelectedProfile] = useState<StudentProfile | null>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const loadStudents = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllStudentsForSupervisor()
      setProfiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alunos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStudents() }, [])

  const handleProfileUpdate = useCallback((
    reg: string,
    certId: number,
    status: 'approved' | 'rejected',
    comment: string,
  ) => {
    setProfiles(prev => prev.map(p => {
      if (p.registration !== reg) return p
      return {
        ...p,
        certificates: p.certificates.map(c =>
          c.id === certId ? { ...c, status, supervisorComment: comment || undefined } : c,
        ),
      }
    }))
    setSelectedProfile(prev => {
      if (!prev || prev.registration !== reg) return prev
      return {
        ...prev,
        certificates: prev.certificates.map(c =>
          c.id === certId ? { ...c, status, supervisorComment: comment || undefined } : c,
        ),
      }
    })
  }, [])

  const pendingCount = (p: StudentProfile) =>
    p.certificates.filter(c => c.status === 'pending').length

  const studentsWithPending = useMemo(
    () => profiles.filter(p => pendingCount(p) > 0).length,
    [profiles],
  )

  const filtered = useMemo(() => {
    let list = profiles
    if (filter === 'pending') list = list.filter(p => pendingCount(p) > 0)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        p =>
          p.student.name.toLowerCase().includes(q) ||
          p.student.registration.toLowerCase().includes(q),
      )
    }
    return list
  }, [profiles, filter, search])

  // Show evaluation view when a student is selected
  if (selectedProfile) {
    return (
      <StudentEvalView
        profile={selectedProfile}
        onBack={() => setSelectedProfile(null)}
        onProfileUpdate={handleProfileUpdate}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f4f1]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <ShieldCheck size={20} />
            <span>Área do Supervisor</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{store.authUser?.email}</span>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-vinho-50 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-vinho-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Total de alunos</p>
              <p className="text-xl font-bold text-gray-800">{profiles.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Alunos com pendências</p>
              <p className="text-xl font-bold text-gray-800">{studentsWithPending}</p>
            </div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou matrícula..."
              className="w-full pl-9 pr-4 h-10 rounded-lg border border-gray-200 text-sm text-gray-800 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none bg-white"
            />
          </div>
          <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setFilter('pending')}
              className={['px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === 'pending' ? 'bg-vinho-600 text-white' : 'text-gray-500 hover:bg-gray-50'].join(' ')}
            >
              Com pendências
            </button>
            <button
              onClick={() => setFilter('all')}
              className={['px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                filter === 'all' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'].join(' ')}
            >
              Todos
            </button>
          </div>
          <button
            onClick={loadStudents}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-vinho-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Carregando alunos...</span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Users size={26} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">
              {search ? 'Nenhum aluno encontrado para a busca.' : 'Nenhum aluno com certificados pendentes.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(profile => {
              const np = pendingCount(profile)
              const total = profile.certificates.length
              const approved = profile.certificates.filter(c => c.status === 'approved').length
              const rejected = profile.certificates.filter(c => c.status === 'rejected').length

              return (
                <button
                  key={profile.registration}
                  onClick={() => setSelectedProfile(profile)}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-4 hover:border-vinho-200 hover:shadow-md transition-all cursor-pointer group text-left w-full"
                >
                  <div className="w-10 h-10 rounded-full bg-vinho-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-vinho-600 font-bold text-sm">
                      {profile.student.name.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{profile.student.name || '(sem nome)'}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-gray-400">Mat.: <span className="text-gray-600">{profile.student.registration}</span></span>
                      <span className="text-xs text-gray-400">Curso: <span className="text-gray-600">
                        {profile.student.course}{profile.student.engineeringType ? ` · ${profile.student.engineeringType}` : ''}
                      </span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {np > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-vinho-100 text-vinho-700">
                        <Clock size={11} />
                        {np} pendente{np > 1 ? 's' : ''}
                      </span>
                    )}
                    {approved > 0 && (
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        {approved} aprovado{approved > 1 ? 's' : ''}
                      </span>
                    )}
                    {rejected > 0 && (
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        {rejected} reprovado{rejected > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{total} cert.</span>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-vinho-500 transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      <LogoutConfirmModal
        open={showLogoutModal}
        email={store.authUser?.email}
        context="supervisor"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false)
          store.logout()
        }}
      />
    </div>
  )
}
