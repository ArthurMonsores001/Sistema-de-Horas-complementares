'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppState, Certificate, Student, StudentProfile } from '@/lib/types'
import { ACTIVITIES } from '@/lib/data'
import { supabase } from '@/lib/supabase'
import {
  AuthUser,
  getSession,
  signOut,
  fetchAllProfiles,
  upsertProfile,
  deleteProfileRemote,
  upsertCertificate,
  deleteCertificateRemote,
  uploadAttachment,
  getAttachmentUrl,
} from '@/lib/api'

const STORAGE_KEY = 'hc-app-v3'

const DEFAULT_STUDENT: Student = {
  name: '',
  registration: '',
  cpf: '',
  rg: '',
  course: 'Engenharia',
  totalRequired: 120,
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
}

function normalizeReg(r: string) {
  return r.trim().replace(/\s+/g, '').toLowerCase()
}

function persist(reg: string, draft: AppState, profiles: Record<string, StudentProfile>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, activeRegistration: reg, draft, profiles }))
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
  const used: Record<number, number> = {}
  const out: Record<number, { effectiveHours: number; excessHours: number }> = {}
  for (const c of [...certs].sort((a, b) => a.id - b.id)) {
    const act = ACTIVITIES.find(a => a.id === c.activityId)
    const limit = act?.maxHours ?? c.hours
    const already = used[c.activityId] ?? 0
    const available = Math.max(0, limit - already)
    const eff = Math.min(c.hours, available)
    const exc = Math.max(0, c.hours - eff)
    used[c.activityId] = already + eff
    out[c.id] = { effectiveHours: eff, excessHours: exc }
  }
  return out
}

export function useStore() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({})
  const [activeRegistration, setActiveRegistration] = useState('')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [apiStatus, setApiStatus] = useState<'local' | 'online' | 'syncing' | 'error'>('local')
  const [apiError, setApiError] = useState('')
  const [hydrated, setHydrated] = useState(false)

  // ── Hydration: local storage + Supabase session ───────────────
  useEffect(() => {
    const init = async () => {
      // Load local cache first (instant UI)
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const p = JSON.parse(raw) as PersistedData
          setProfiles(p.profiles ?? {})
          setActiveRegistration(p.activeRegistration ?? '')
          setState(p.draft ?? DEFAULT_STATE)
        }
      } catch { /* ignore */ }

      // Check Supabase session
      const user = await getSession()
      if (user) {
        setAuthUser(user)
        setApiStatus('online')
        await pullRemoteProfiles(user)
      }

      setAuthChecking(false)
      setHydrated(true)
    }

    init()

    // Listen for auth state changes (e.g. token refresh, sign out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthUser(null)
        setApiStatus('local')
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Internal: pull all profiles from Supabase ─────────────────
  const pullRemoteProfiles = useCallback(async (user?: AuthUser) => {
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  // ── Auth callbacks ────────────────────────────────────────────
  const onAuthSuccess = useCallback(async (user: AuthUser) => {
    setAuthUser(user)
    setApiStatus('online')
    await pullRemoteProfiles(user)
  }, [pullRemoteProfiles])

  const logout = useCallback(async () => {
    await signOut()
    setAuthUser(null)
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
    async (cert: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>) => {
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

      if (!authUser) return

      try {
        setApiStatus('syncing')
        setApiError('')
        const profileRow = await upsertProfile(state.student, authUser.id)

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

        const persisted = await upsertCertificate({ ...savedCert, id: 0 }, profileRow.id)

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
      } catch (err) {
        setApiStatus('error')
        setApiError(err instanceof Error ? err.message : 'Erro ao salvar certificado.')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authUser, state, activeRegistration, profiles],
  )

  const updateCertificate = useCallback(
    async (id: number, partial: Partial<Certificate>) => {
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

      if (!authUser) return
      try {
        setApiStatus('syncing')
        setApiError('')
        const full = state.certificates.find(c => c.id === id)
        if (!full) {
          setApiStatus('error')
          setApiError('Certificado não encontrado para atualizar.')
          return
        }
        const profileRow = await upsertProfile(state.student, authUser.id)
        await upsertCertificate({ ...full, ...partial, id }, profileRow.id)
        setApiStatus('online')
        setApiError('')
      } catch (err) {
        setApiStatus('error')
        setApiError(err instanceof Error ? err.message : 'Erro ao atualizar certificado.')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authUser, state, activeRegistration, profiles],
  )

  const deleteCertificate = useCallback(
    async (id: number) => {
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
          await deleteProfileRemote(reg)
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

  // ── Attachment URL helper ─────────────────────────────────────

  const resolveAttachmentUrl = useCallback(
    async (storagePath: string): Promise<string> => {
      return getAttachmentUrl(storagePath)
    },
    [],
  )

  // ── Import / Export ───────────────────────────────────────────

  const exportAllProfiles = useCallback(
    () => ({ version: 3, activeRegistration, profiles, draft: state }),
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
    apiStatus,
    apiError,
    hydrated,

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

    // Backend
    pullFromBackend,
    syncToBackend,
    resolveAttachmentUrl,

    // Import / Export
    exportAllProfiles,
    importData,
    clearAll,
  }
}

export type StoreType = ReturnType<typeof useStore>
