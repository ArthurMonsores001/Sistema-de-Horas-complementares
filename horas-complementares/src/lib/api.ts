/**
 * API helpers — todas as operações de backend agora usam o Supabase.
 * O cliente Django foi removido; este arquivo expõe as mesmas
 * assinaturas usadas pelo useStore para manter compatibilidade.
 */
import { supabase, DbProfile, DbCertificate, DbUserRole } from './supabase'
import { Certificate, CertificateStatus, Student, StudentProfile, UserRole } from './types'

const PROFILE_SELECT = 'id,user_id,registration,name,cpf,course,engineering_type,total_required,updated_at'
// Supervisor não precisa ver CPF dos alunos — menor superfície de exposição
const SUPERVISOR_PROFILE_SELECT = 'id,user_id,registration,name,course,engineering_type,total_required,updated_at'

// ── Auth ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_already_exists: 'Este e-mail já está cadastrado.',
  weak_password: 'Senha fraca. Use no mínimo 10 caracteres, com letra minúscula, maiúscula, número e caractere especial.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  over_email_send_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
}

function authMessage(error: { code?: string; message?: string; status?: number } | null, fallback: string): string {
  if (!error) return fallback
  if (error.code && AUTH_ERRORS[error.code]) return AUTH_ERRORS[error.code]
  if (error.message === 'Invalid login credentials') return AUTH_ERRORS.invalid_credentials
  if (error.message === 'User already registered') return AUTH_ERRORS.user_already_exists
  if (error.status === 429) return AUTH_ERRORS.over_request_rate_limit
  return fallback
}

export async function signUp(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  })
  if (error || !data.user) throw new Error(authMessage(error, 'Falha ao criar conta.'))
  return { id: data.user.id, email: data.user.email ?? '' }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(authMessage(error, 'Não foi possível entrar. Tente novamente.'))
  return { id: data.user.id, email: data.user.email ?? '' }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  })
  if (error) throw new Error(authMessage(error, 'Não foi possível enviar o e-mail. Tente novamente.'))
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    const same = error.code === 'same_password'
    throw new Error(same ? 'A nova senha deve ser diferente da atual.' : authMessage(error, 'Não foi possível alterar a senha. Tente novamente.'))
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    const user = data.user
    if (!user) {
      // 401/403 = servidor recusou o token (usuario excluido ou sessao revogada).
      // Erro de rede nao tem esse status, entao nao derruba quem esta offline.
      const status = (error as { status?: number } | null)?.status
      if (status === 401 || status === 403) await supabase.auth.signOut({ scope: 'local' })
      return null
    }
    return { id: user.id, email: user.email ?? '' }
  } catch {
    // Chamada concorrente (ex: StrictMode) pode ter o lock de auth "roubado"
    // por outra chamada mais recente; trate como sessão indisponível nesta tentativa.
    return null
  }
}

// ── Profiles ──────────────────────────────────────────────────────

function dbProfileToStudent(row: DbProfile): Student {
  return {
    name: row.name,
    registration: row.registration,
    cpf: row.cpf ?? '',
    course: row.course,
    engineeringType: row.engineering_type ?? undefined,
    totalRequired: row.total_required,
  }
}

export async function fetchAllProfiles(userId: string): Promise<StudentProfile[]> {
  const { data: profiles, error } = await supabase
    .from('student_profiles')
    .select(`${PROFILE_SELECT}, certificates(*)`)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (profiles as (DbProfile & { certificates: DbCertificate[] })[]).map(profile => ({
    registration: profile.registration,
    student: dbProfileToStudent(profile),
    certificates: (profile.certificates ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(dbCertToLocal),
    updatedAt: profile.updated_at,
  }))
}

export async function upsertProfile(student: Student, userId: string): Promise<DbProfile> {
  const { data, error } = await supabase
    .from('student_profiles')
    .upsert({
      user_id: userId,
      registration: student.registration.trim().toLowerCase(),
      name: student.name,
      cpf: student.cpf,
      course: student.course,
      engineering_type: student.course === 'Engenharia' ? (student.engineeringType ?? null) : null,
      total_required: student.totalRequired,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,registration' })
    .select(PROFILE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return data as DbProfile
}

export async function deleteProfileRemote(registration: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('student_profiles')
    .delete()
    .eq('registration', registration.trim().toLowerCase())
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

// ── Certificates ──────────────────────────────────────────────────

function dbCertToLocal(row: DbCertificate): Certificate {
  return {
    id: row.id,
    activityId: row.activity_id,
    description: row.description,
    hours: row.hours,
    date: row.date,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at ?? undefined,
    status: (row.status as CertificateStatus) ?? 'draft',
    supervisorComment: row.supervisor_comment ?? undefined,
    attachment: (row.attachment_name || row.storage_path) ? {
      name: row.attachment_name ?? '',
      type: row.attachment_type ?? '',
      size: row.attachment_size ?? 0,
      fileHash: row.file_hash ?? undefined,
      storagePath: row.storage_path ?? undefined,
    } : undefined,
    extractedData: row.extracted_data as unknown as Certificate['extractedData'],
  }
}

export async function upsertCertificate(
  cert: Certificate,
  profileId: string,
): Promise<Certificate> {
  const basePayload = {
    profile_id: profileId,
    activity_id: cert.activityId,
    description: cert.description,
    hours: cert.hours,
    date: cert.date,
    location: cert.location,
    attachment_name: cert.attachment?.name ?? null,
    attachment_type: cert.attachment?.type ?? null,
    attachment_size: cert.attachment?.size ?? null,
    file_hash: cert.attachment?.fileHash ?? null,
    storage_path: cert.attachment?.storagePath ?? null,
    extracted_data: cert.extractedData
      ? (cert.extractedData as unknown as Record<string, unknown>)
      : null,
    submitted_at: cert.submittedAt ?? null,
    updated_at: new Date().toISOString(),
  }

  if (cert.id) {
    // Exclude status and supervisor_comment from student updates — only supervisor may set these
    const { data, error } = await supabase
      .from('certificates')
      .update(basePayload)
      .eq('id', cert.id)
      .eq('profile_id', profileId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return dbCertToLocal(data as DbCertificate)
  } else {
    const { data, error } = await supabase
      .from('certificates')
      .insert({ ...basePayload, status: cert.status ?? 'draft', supervisor_comment: cert.supervisorComment ?? null, created_at: new Date().toISOString() })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return dbCertToLocal(data as DbCertificate)
  }
}

export async function deleteCertificateRemote(certId: number): Promise<void> {
  const { error } = await supabase
    .from('certificates')
    .delete()
    .eq('id', certId)
  if (error) throw new Error(error.message)
}

export async function findCertificateByFileHash(
  profileId: string,
  fileHash: string,
  excludeCertId?: number,
): Promise<Certificate | null> {
  let query = supabase
    .from('certificates')
    .select('*')
    .eq('profile_id', profileId)
    .eq('file_hash', fileHash)
    .limit(1)

  if (excludeCertId) {
    query = query.neq('id', excludeCertId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? dbCertToLocal(data as DbCertificate) : null
}

// ── Storage ───────────────────────────────────────────────────────

export async function uploadAttachment(
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('certificates')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(error.message)
  return path
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('certificates')
    .createSignedUrl(storagePath, 5 * 60) // 5 minutes — shorter TTL reduces exposure window

  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Erro ao obter URL')
  return data.signedUrl
}

export async function deleteAttachment(storagePath: string): Promise<void> {
  await supabase.storage.from('certificates').remove([storagePath])
}

// ── Roles ─────────────────────────────────────────────────────────

export async function getUserRole(userId: string): Promise<UserRole> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  return ((data as DbUserRole | null)?.role as UserRole) ?? 'student'
}

// ── Supervisor ────────────────────────────────────────────────────

export async function fetchAllStudentsForSupervisor(): Promise<StudentProfile[]> {
  const { data: profiles, error } = await supabase
    .from('student_profiles')
    .select(`${SUPERVISOR_PROFILE_SELECT}, certificates(*)`)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (profiles as (DbProfile & { certificates: DbCertificate[] })[]).map(profile => ({
    registration: profile.registration,
    student: dbProfileToStudent(profile),
    certificates: (profile.certificates ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(dbCertToLocal),
    updatedAt: profile.updated_at,
  }))
}

export async function submitCertificateForReview(certId: number): Promise<void> {
  const { error } = await supabase
    .from('certificates')
    .update({
      status: 'pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', certId)

  if (error) throw new Error(error.message)
}

export async function submitMultipleCertificatesForReview(certIds: number[]): Promise<void> {
  if (certIds.length === 0) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('certificates')
    .update({ status: 'pending', submitted_at: now, updated_at: now })
    .in('id', certIds)

  if (error) throw new Error(error.message)
}

export async function reviewCertificate(
  certId: number,
  status: 'approved' | 'rejected',
  comment?: string,
): Promise<void> {
  const { error } = await supabase
    .from('certificates')
    .update({
      status,
      supervisor_comment: comment ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', certId)

  if (error) throw new Error(error.message)
}

export async function supervisorEditCertificate(
  certId: number,
  patch: { activityId: number; hours: number },
): Promise<void> {
  const { error } = await supabase
    .from('certificates')
    .update({
      activity_id: patch.activityId,
      hours: patch.hours,
      updated_at: new Date().toISOString(),
    })
    .eq('id', certId)

  if (error) throw new Error(error.message)
}
