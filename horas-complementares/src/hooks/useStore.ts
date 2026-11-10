'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppState, Certificate, Student, StudentProfile, UserRole } from '@/lib/types'
import { ACTIVITIES } from '@/lib/data'
import { supabase, openedRecoveryLink, openedExpiredLink } from '@/lib/supabase'
import { checkDuplicate } from '@/lib/duplicateChecker'
import {
  AuthUser,
  getSession,
  signOut,
  fetchAllProfiles,
  upsertProfile,
  deleteProfileRemote,
  upsertCertificate,
  deleteCertificateRemote,
  findCertificateByFileHash,
  uploadAttachment,
  getAttachmentUrl,
  submitCertificateForReview,
  submitMultipleCertificatesForReview,
  getUserRole,
} from '@/lib/api'

const STORAGE_KEY = 'hc-app-v3'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 horas

const DEFAULT_STUDENT: Student = {
  name: '',
  registration: '',
  cpf: '',
  course: 'Engenharia',
  engineeringType: '',
  totalRequired: 180,
}

const DEFAULT_STATE: AppState = {
  student: { ...DEFAULT_STUDENT },
  certificates: [],
}

interface PersistedData {
  version: number
  activeRegistration: string
  draft: AppState
  profiles: Record<string, StudentProfile>
  savedAt?: number
}

function normalizeReg(r: string) {
  return r.trim().replace(/\s+/g, '').toLowerCase()
}

function persist(reg: string, draft: AppState, profiles: Record<string, StudentProfile>) {
  try {
    // CPF is not cached locally — always refreshed from Supabase on login
    const safeDraft = { ...draft, student: { ...draft.student, cpf: '' } }
    const safeProfiles = Object.fromEntries(
      Object.entries(profiles).map(([k, p]) => [k, { ...p, student: { ...p.student, cpf: '' } }])
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 3,
      activeRegistration: reg,
      draft: safeDraft,
      profiles: safeProfiles,
      savedAt: Date.now(),
    }))
  } catch { /* quota */ }
}

function scopeStateToProfile(
  reg: string,
  draft: AppState,
  profiles: Record<string, StudentProfile>,
) {
  const registration = normalizeReg(draft.student.registration || reg)
  if (!registration) return { registration: reg, profiles }

  const nextProfiles = {
    ...profiles,
    [registration]: {
      registration,
      student: { ...draft.student, registration: draft.student.registration.trim() },
      certificates: draft.certificates,
      updatedAt: new Date().toISOString(),
    },
  }

  return { registration, profiles: nextProfiles }
}

// ── Usage computation ─────────────────────────────────────────────
function computeUsage(certs: Certificate[]) {
  const out: Record<number, { effectiveHours: number; excessHours: number }> = {}
  for (const c of certs) {
    // Só conta se aprovado pelo supervisor. Sem status = dado anterior ao fluxo de avaliação, conta normalmente.
    if (c.status && c.status !== 'approved') {
      out[c.id] = { effectiveHours: 0, excessHours: 0 }
      continue
    }
    const act = ACTIVITIES.find(a => a.id === c.activityId)
    const limit = act?.maxHours ?? c.hours
    const eff = Math.min(c.hours, limit)
    const exc = Math.max(0, c.hours - eff)
    out[c.id] = { effectiveHours: eff, excessHours: exc }
  }
  return out
}

function duplicateMessage(cert: Certificate | undefined, reason?: 'file_hash' | 'metadata') {
  const descriptionPart = cert?.description ? ` (${cert.description})` : ''
  if (reason === 'metadata') {
    return `Esta atividade já foi cadastrada anteriormente${descriptionPart}.`
  }
  if (!cert) return 'Este arquivo já foi enviado anteriormente.'
  return `Este arquivo já foi enviado anteriormente${descriptionPart}.`
}

export function useStore() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({})
  const [activeRegistration, setActiveRegistration] = useState('')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [userRole, setUserRole] = useState<UserRole>('student')
  const [apiStatus, setApiStatus] = useState<'local' | 'online' | 'syncing' | 'error'>('local')
  const [apiError, setApiError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [linkExpired, setLinkExpired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  // ── Hydration: local storage + Supabase session ───────────────
  useEffect(() => {
    if (openedRecoveryLink) setRecovering(true)
    if (openedExpiredLink) setLinkExpired(true)

    const init = async () => {
      // Load local cache first (instant UI) — reject if expired
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const p = JSON.parse(raw) as PersistedData
          const expired = !p.savedAt || (Date.now() - p.savedAt > CACHE_TTL_MS)
          if (expired) {
            localStorage.removeItem(STORAGE_KEY)
          } else {
            setProfiles(p.profiles ?? {})
            setActiveRegistration(p.activeRegistration ?? '')
            setState(p.draft ?? DEFAULT_STATE)
          }
        }
      } catch { /* ignore */ }

      // Check Supabase session
      const user = await getSession()

      // Tokens do link de e-mail ja foram consumidos: tira o hash da barra de enderecos
      try {
        if (/access_token|refresh_token|error_code/.test(window.location.hash)) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      } catch { /* ignore */ }

      if (user) {
        setAuthUser(user)
        setApiStatus('online')
        await loadUserData(user)
      }

      setAuthChecking(false)
      setHydrated(true)
    }

    init()

    // Listen for auth state changes (e.g. token refresh, sign out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (!session) {
        setAuthUser(null)
        setApiStatus('local')
      }
    })

    // Ao voltar para a aba, confirma no servidor que o usuario ainda existe
    const recheck = async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase.auth.getSession()
      if (data.session && !(await getSession())) {
        const { data: after } = await supabase.auth.getSession()
        if (!after.session) window.location.reload()
      }
    }
    document.addEventListener('visibilitychange', recheck)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', recheck)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Internal: pull all profiles from Supabase ─────────────────
  const pullRemoteProfiles = useCallback(async (user?: AuthUser, rethrow = false) => {
    const u = user ?? authUser
    if (!u) return
    try {
      setApiStatus('syncing')
      const remote = await fetchAllProfiles(u.id)
      const map: Record<string, StudentProfile> = {}
      for (const p of remote) map[normalizeReg(p.registration)] = p

      setProfiles(() => {
        const reg = Object.keys(map)[0] || ''
        let nextState: AppState = DEFAULT_STATE
        if (reg && map[reg]) {
          const p = map[reg]
          nextState = { student: p.student, certificates: p.certificates }
        }
        setState(nextState)
        setActiveRegistration(reg)
        persist(reg, nextState, map)
        return map
      })
      setApiStatus('online')
      setApiError('')
    } catch (err) {
      setApiStatus('error')
      setApiError(err instanceof Error ? err.message : 'Erro ao buscar dados.')
      if (rethrow) throw err
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  // ── Internal: papel + perfis, com uma nova tentativa automatica ──
  // Devolve null se falhou: a tela mostra erro em vez de uma conta vazia.
  const loadUserData = useCallback(async (user: AuthUser): Promise<UserRole | null> => {
    const attempt = async () => {
      const role = await getUserRole(user.id)
      setUserRole(role)
      if (role === 'student') await pullRemoteProfiles(user, true)
      return role
    }
    try {
      const role = await attempt().catch(attempt)
      setLoadFailed(false)
      return role
    } catch {
      setLoadFailed(true)
      setApiStatus('error')
      return null
    }
  }, [pullRemoteProfiles])

  const retryLoad = useCallback(async () => {
    if (authUser) await loadUserData(authUser)
  }, [authUser, loadUserData])

  // ── Auth callbacks ────────────────────────────────────────────
  const onAuthSuccess = useCallback(async (user: AuthUser): Promise<UserRole | null> => {
    setAuthUser(user)
    setApiStatus('online')
    return loadUserData(user)
  }, [loadUserData])

  const finishRecovery = useCallback(() => {
    setRecovering(false)
    try { window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
  }, [])

  const dismissExpiredLink = useCallback(() => {
    setLinkExpired(false)
    try { window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ }
  }, [])

  const logout = useCallback(async () => {
    setRecovering(false)
    await signOut()
    setAuthUser(null)
    setUserRole('student')
    setLoadFailed(false)
    setApiStatus('local')
    setApiError('')
    setProfiles({})
    setState(DEFAULT_STATE)
    setActiveRegistration('')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  // ── Computed ──────────────────────────────────────────────────
  const getCertificateUsage = useCallback(() => computeUsage(state.certificates), [state.certificates])

  const getActivitySubmitted = useCallback(
    (actId: number) => state.certificates.filter(c => c.activityId === actId).reduce((s, c) => s + c.hours, 0),
    [state.certificates],
  )

  const getActivityEffective = useCallback(
    (actId: number) => {
      const u = computeUsage(state.certificates)
      return state.certificates.filter(c => c.activityId === actId).reduce((s, c) => s + (u[c.id]?.effectiveHours ?? c.hours), 0)
    },
    [state.certificates],
  )

  const getCategoryEffective = useCallback(
    (catId: number) => {
      const ids = ACTIVITIES.filter(a => a.categoryId === catId).map(a => a.id)
      const u = computeUsage(state.certificates)
      return state.certificates.filter(c => ids.includes(c.activityId)).reduce((s, c) => s + (u[c.id]?.effectiveHours ?? c.hours), 0)
    },
    [state.certificates],
  )

  const getCategoryMax = useCallback(
    (catId: number) => ACTIVITIES.filter(a => a.categoryId === catId).reduce((s, a) => s + a.maxHours, 0),
    [],
  )

  const getTotalEffective = useCallback(() => {
    const u = computeUsage(state.certificates)
    return state.certificates.reduce((s, c) => s + (u[c.id]?.effectiveHours ?? c.hours), 0)
  }, [state.certificates])

  // ── Certificate mutations ─────────────────────────────────────

  const addCertificate = useCallback(
    async (cert: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
      const duplicateCheck = checkDuplicate(cert, state.certificates)
      if (duplicateCheck.isDuplicate) {
        setApiError(duplicateMessage(duplicateCheck.matchingCertificate, duplicateCheck.reason))
        return false
      }

      let profileRowId: string | null = null

      if (authUser) {
        try {
          setApiStatus('syncing')
          setApiError('')
          const profileRow = await upsertProfile(state.student, authUser.id)
          profileRowId = profileRow.id

          if (cert.attachment?.fileHash) {
            const remoteDuplicate = await findCertificateByFileHash(profileRow.id, cert.attachment.fileHash)
            if (remoteDuplicate) {
              setApiStatus('online')
              setApiError(duplicateMessage(remoteDuplicate))
              return false
            }
          }
        } catch (err) {
          setApiStatus('error')
          setApiError(err instanceof Error ? err.message : 'Erro ao validar certificado.')
          return false
        }
      }

      // Optimistic: assign a temp negative id so the UI updates instantly
      const tempId = -(Date.now())
      const now = new Date().toISOString()
      const optimistic: Certificate = { ...cert, id: tempId, createdAt: now, updatedAt: now }
      const optimisticState = { ...state, certificates: [...state.certificates, optimistic] }
      const optimisticScoped = scopeStateToProfile(activeRegistration, optimisticState, profiles)

      setState(optimisticState)
      setProfiles(optimisticScoped.profiles)
      setActiveRegistration(optimisticScoped.registration)
      persist(optimisticScoped.registration, optimisticState, optimisticScoped.profiles)

      if (!authUser) return true

      try {
        setApiStatus('syncing')
        setApiError('')

        // Upload attachment if it has a dataUrl (not yet in storage)
        let savedCert = { ...cert } as Certificate
        if (cert.attachment?.dataUrl && !cert.attachment.storagePath) {
          const dataUrl = cert.attachment.dataUrl
          const byteString = atob(dataUrl.split(',')[1])
          const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
          const file = new File([ab], cert.attachment.name, { type: mimeString })
          const storagePath = await uploadAttachment(authUser.id, file)
          savedCert = { ...savedCert, attachment: { ...cert.attachment, dataUrl: undefined, storagePath } }
        }

        if (!profileRowId) throw new Error('Perfil não encontrado.')
        const persisted = await upsertCertificate({ ...savedCert, id: 0 }, profileRowId)

        // Replace temp id with real id
        const next = {
          ...optimisticState,
          certificates: optimisticState.certificates.map(c => c.id === tempId ? persisted : c),
        }
        const scoped = scopeStateToProfile(optimisticScoped.registration, next, optimisticScoped.profiles)
        setState(next)
        setProfiles(scoped.profiles)
        setActiveRegistration(scoped.registration)
        persist(scoped.registration, next, scoped.profiles)
        setApiStatus('online')
        setApiError('')
        return true
      } catch (err) {
        // Targeted rollback: remove only the temp cert from current state (safe from stale closures)
        setState(prev => ({ ...prev, certificates: prev.certificates.filter(c => c.id !== tempId) }))
        setProfiles(prev => {
          const reg = optimisticScoped.registration
          if (!prev[reg]) return prev
          return {
            ...prev,
            [reg]: { ...prev[reg], certificates: prev[reg].certificates.filter(c => c.id !== tempId) },
          }
        })
        persist(activeRegistration, state, profiles)
        setApiStatus('error')
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
          setApiError('Este certificado já foi cadastrado anteriormente.')
        } else {
          setApiError(msg || 'Erro ao salvar certificado.')
        }
        return false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authUser, state, activeRegistration, profiles],
  )

  const updateCertificate = useCallback(
    async (id: number, partial: Partial<Certificate>): Promise<boolean> => {
      const current = state.certificates.find(c => c.id === id)
      if (!current) {
        setApiStatus('error')
        setApiError('Certificado não encontrado para atualizar.')
        return false
      }

      const candidate = { ...current, ...partial }
      if (candidate.attachment?.fileHash) {
        const localDuplicate = state.certificates.find(c => c.id !== id && c.attachment?.fileHash === candidate.attachment?.fileHash)
        if (localDuplicate) {
          setApiError(duplicateMessage(localDuplicate))
          return false
        }
      }

      const next = {
        ...state,
        certificates: state.certificates.map(c =>
          c.id === id ? { ...c, ...partial, updatedAt: new Date().toISOString() } : c,
        ),
      }
      const scoped = scopeStateToProfile(activeRegistration, next, profiles)
      setState(next)
      setProfiles(scoped.profiles)
      setActiveRegistration(scoped.registration)
      persist(scoped.registration, next, scoped.profiles)

      if (!authUser) return true
      try {
        setApiStatus('syncing')
        setApiError('')
        const profileRow = await upsertProfile(state.student, authUser.id)
        if (candidate.attachment?.fileHash) {
          const remoteDuplicate = await findCertificateByFileHash(profileRow.id, candidate.attachment.fileHash, id)
          if (remoteDuplicate) {
            setState(state)
            setProfiles(profiles)
            setActiveRegistration(activeRegistration)
            persist(activeRegistration, state, profiles)
            setApiStatus('online')
            setApiError(duplicateMessage(remoteDuplicate))
            return false
          }
        }
        await upsertCertificate({ ...candidate, id }, profileRow.id)
        setApiStatus('online')
        setApiError('')
        return true
      } catch (err) {
        // Targeted rollback: restore the original cert in current state (safe from stale closures)
        setState(prev => ({
          ...prev,
          certificates: prev.certificates.map(c => c.id === id ? current! : c),
        }))
        setProfiles(prev => {
          const reg = scoped.registration
          if (!prev[reg]) return prev
          return {
            ...prev,
            [reg]: {
              ...prev[reg],
              certificates: prev[reg].certificates.map(c => c.id === id ? current! : c),
            },
          }
        })
        persist(activeRegistration, state, profiles)
        setApiStatus('error')
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
          setApiError('Este certificado já foi cadastrado anteriormente.')
        } else {
          setApiError(msg || 'Erro ao atualizar certificado.')
        }
        return false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authUser, state, activeRegistration, profiles],
  )

  const deleteCertificate = useCallback(
    async (id: number) => {
      const deletedCert = state.certificates.find(c => c.id === id)
      const next = { ...state, certificates: state.certificates.filter(c => c.id !== id) }
      const scoped = scopeStateToProfile(activeRegistration, next, profiles)
      setState(next)
      setProfiles(scoped.profiles)
      setActiveRegistration(scoped.registration)
      persist(scoped.registration, next, scoped.profiles)
      if (authUser && id > 0) {
        try {
          setApiStatus('syncing')
          setApiError('')
          await deleteCertificateRemote(id)
          setApiStatus('online')
          setApiError('')
        } catch (err) {
          // Targeted rollback: re-insert the deleted cert into current state (safe from stale closures)
          if (deletedCert) {
            setState(prev => ({ ...prev, certificates: [...prev.certificates, deletedCert] }))
            setProfiles(prev => {
              const reg = scoped.registration
              if (!prev[reg]) return prev
              return {
                ...prev,
                [reg]: { ...prev[reg], certificates: [...prev[reg].certificates, deletedCert] },
              }
            })
          }
          persist(activeRegistration, state, profiles)
          setApiStatus('error')
          setApiError(err instanceof Error ? err.message : 'Erro ao excluir certificado no Supabase.')
        }
      }
    },
    [authUser, state, activeRegistration, profiles],
  )

  // ── Profile management ────────────────────────────────────────

  const saveProfile = useCallback(
    async (studentData: Student, userOverride?: AuthUser): Promise<boolean> => {
      const reg = normalizeReg(studentData.registration)
      if (!reg) return false

      const nextState: AppState = { ...state, student: { ...studentData } }
      const profile: StudentProfile = {
        registration: reg,
        student: { ...studentData },
        certificates: state.certificates,
        updatedAt: new Date().toISOString(),
      }
      const nextProfiles = { ...profiles, [reg]: profile }
      setState(nextState)
      setProfiles(nextProfiles)
      setActiveRegistration(reg)
      persist(reg, nextState, nextProfiles)

      const userToSave = userOverride ?? authUser
      if (userToSave) {
        try {
          setApiStatus('syncing')
          await upsertProfile(studentData, userToSave.id)
          setApiStatus('online')
          setApiError('')
        } catch (err) {
          setApiStatus('error')
          setApiError(err instanceof Error ? err.message : 'Erro ao salvar perfil no Supabase.')
          return false
        }
      }
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, profiles, authUser],
  )

  const loadProfile = useCallback(
    (registration: string): boolean => {
      const reg = normalizeReg(registration)
      const profile = profiles[reg]
      if (!profile) return false
      const next: AppState = { student: profile.student, certificates: profile.certificates }
      setState(next)
      setActiveRegistration(reg)
      persist(reg, next, profiles)
      return true
    },
    [profiles],
  )

  const deleteProfile = useCallback(
    async (registration: string): Promise<boolean> => {
      const reg = normalizeReg(registration)
      if (!profiles[reg]) return false

      const nextProfiles = { ...profiles }
      delete nextProfiles[reg]

      const remaining = Object.values(nextProfiles)
      const nextReg = remaining[0]?.registration ?? ''
      const nextState = remaining[0]
        ? { student: remaining[0].student, certificates: remaining[0].certificates }
        : DEFAULT_STATE

      setState(nextState)
      setProfiles(nextProfiles)
      setActiveRegistration(nextReg)
      persist(nextReg, nextState, nextProfiles)

      if (authUser) {
        try {
          setApiStatus('syncing')
          setApiError('')
          await deleteProfileRemote(reg, authUser.id)
          setApiStatus('online')
          setApiError('')
        } catch (err) {
          setApiStatus('error')
          setApiError(err instanceof Error ? err.message : 'Erro ao excluir perfil no Supabase.')
          return false
        }
      }
      return true
    },
    [profiles, authUser],
  )

  const getSavedProfiles = useCallback(
    (): StudentProfile[] => Object.values(profiles),
    [profiles],
  )

  // ── Submit for review ─────────────────────────────────────────

  const submitForReview = useCallback(
    async (certId: number): Promise<boolean> => {
      if (!authUser) return false
      try {
        setApiStatus('syncing')
        setApiError('')
        await submitCertificateForReview(certId)
        const next = {
          ...state,
          certificates: state.certificates.map(c =>
            c.id === certId ? { ...c, status: 'pending' as const, submittedAt: new Date().toISOString() } : c,
          ),
        }
        const scoped = scopeStateToProfile(activeRegistration, next, profiles)
        setState(next)
        setProfiles(scoped.profiles)
        persist(scoped.registration, next, scoped.profiles)
        setApiStatus('online')
        return true
      } catch (err) {
        setApiStatus('error')
        setApiError(err instanceof Error ? err.message : 'Erro ao enviar para avaliação.')
        return false
      }
    },
    [authUser, state, activeRegistration, profiles],
  )

  const submitMultipleForReview = useCallback(
    async (certIds: number[]): Promise<boolean> => {
      if (!authUser || certIds.length === 0) return false
      try {
        setApiStatus('syncing')
        setApiError('')
        await submitMultipleCertificatesForReview(certIds)
        const now = new Date().toISOString()
        const idSet = new Set(certIds)
        const next = {
          ...state,
          certificates: state.certificates.map(c =>
            idSet.has(c.id) ? { ...c, status: 'pending' as const, submittedAt: now } : c,
          ),
        }
        const scoped = scopeStateToProfile(activeRegistration, next, profiles)
        setState(next)
        setProfiles(scoped.profiles)
        persist(scoped.registration, next, scoped.profiles)
        setApiStatus('online')
        return true
      } catch (err) {
        setApiStatus('error')
        setApiError(err instanceof Error ? err.message : 'Erro ao enviar certificados para avaliação.')
        return false
      }
    },
    [authUser, state, activeRegistration, profiles],
  )

  // ── Attachment URL helper ─────────────────────────────────────

  const resolveAttachmentUrl = useCallback(
    async (storagePath: string): Promise<string> => {
      return getAttachmentUrl(storagePath)
    },
    [],
  )

  // ── Import / Export ───────────────────────────────────────────

  const exportAllProfiles = useCallback(
    () => {
      const safeProfiles = Object.fromEntries(
        Object.entries(profiles).map(([k, p]) => [k, { ...p, student: { ...p.student, cpf: '' } }])
      )
      const safeDraft = { ...state, student: { ...state.student, cpf: '' } }
      return { version: 3, activeRegistration, profiles: safeProfiles, draft: safeDraft }
    },
    [activeRegistration, profiles, state],
  )

  const importData = useCallback(
    (data: Record<string, unknown> | string) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      const importedProfiles = (parsed.profiles as Record<string, StudentProfile>) ?? {}
      const importedDraft = (parsed.draft as AppState) ?? DEFAULT_STATE
      const importedReg = (parsed.activeRegistration as string) ?? ''
      const merged = { ...profiles, ...importedProfiles }
      const nextReg = importedReg || Object.keys(merged)[0] || ''
      const nextState = merged[nextReg]
        ? { student: merged[nextReg].student, certificates: merged[nextReg].certificates }
        : importedDraft
      setState(nextState)
      setProfiles(merged)
      setActiveRegistration(nextReg)
      persist(nextReg, nextState, merged)
    },
    [profiles],
  )

  const clearAll = useCallback(() => {
    setState(DEFAULT_STATE)
    setProfiles({})
    setActiveRegistration('')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  // ── Sync status ───────────────────────────────────────────────

  const pullFromBackend = useCallback(async (): Promise<boolean> => {
    try { await pullRemoteProfiles(); return true }
    catch { return false }
  }, [pullRemoteProfiles])

  const syncToBackend = useCallback(async (): Promise<boolean> => {
    if (!authUser) return false
    try {
      setApiStatus('syncing')
      await upsertProfile(state.student, authUser.id)
      setApiStatus('online')
      setApiError('')
      return true
    } catch (err) {
      setApiStatus('error')
      setApiError(err instanceof Error ? err.message : 'Erro ao sincronizar.')
      return false
    }
  }, [authUser, state.student])

  return {
    // State
    state,
    profiles,
    activeRegistration,
    authUser,
    authChecking,
    userRole,
    apiStatus,
    apiError,
    hydrated,
    recovering,
    linkExpired,
    loadFailed,
    retryLoad,

    // Computed
    getCertificateUsage,
    getActivitySubmitted,
    getActivityEffective,
    getCategoryEffective,
    getCategoryMax,
    getTotalEffective,

    // Certificate mutations
    addCertificate,
    updateCertificate,
    deleteCertificate,

    // Profile management
    saveProfile,
    loadProfile,
    deleteProfile,
    getSavedProfiles,

    // Auth
    onAuthSuccess,
    logout,
    finishRecovery,
    dismissExpiredLink,

    // Backend
    pullFromBackend,
    syncToBackend,
    resolveAttachmentUrl,
    submitForReview,
    submitMultipleForReview,

    // Import / Export
    exportAllProfiles,
    importData,
    clearAll,
  }
}

export type StoreType = ReturnType<typeof useStore>
