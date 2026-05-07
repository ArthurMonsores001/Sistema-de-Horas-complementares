/**
 * API helpers — todas as operações de backend agora usam o Supabase.
 * O cliente Django foi removido; este arquivo expõe as mesmas
 * assinaturas usadas pelo useStore para manter compatibilidade.
 */
import { supabase, DbProfile, DbCertificate } from './supabase'
import { Certificate, Student, StudentProfile } from './types'

// ── Auth ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

export async function signUp(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error || !data.user) throw new Error(error?.message ?? 'Falha ao criar conta.')
  return { id: data.user.id, email: data.user.email ?? '' }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(error?.message ?? 'Usuário ou senha incorretos.')
  return { id: data.user.id, email: data.user.email ?? '' }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getSession(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return null
  return { id: user.id, email: user.email ?? '' }
}

// ── Profiles ──────────────────────────────────────────────────────

function dbProfileToStudent(row: DbProfile): Student {
  return {
    name: row.name,
    registration: row.registration,
    cpf: row.cpf,
    rg: row.rg,
    course: row.course,
    totalRequired: row.total_required,
  }
}

export async function fetchAllProfiles(userId: string): Promise<StudentProfile[]> {
  const { data: profiles, error } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  const result: StudentProfile[] = []
  for (const profile of (profiles as DbProfile[])) {
    const { data: certs } = await supabase
      .from('certificates')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: true })

    result.push({
      registration: profile.registration,
      student: dbProfileToStudent(profile),
      certificates: (certs as DbCertificate[] ?? []).map(dbCertToLocal),
      updatedAt: profile.updated_at,
    })
  }
  return result
}

export async function upsertProfile(student: Student, userId: string): Promise<DbProfile> {
  const { data, error } = await supabase
    .from('student_profiles')
    .upsert({
      user_id: userId,
      registration: student.registration.trim().toLowerCase(),
      name: student.name,
      cpf: student.cpf,
      rg: student.rg,
      course: student.course,
      total_required: student.totalRequired,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,registration' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as DbProfile
}

export async function deleteProfileRemote(registration: string): Promise<void> {
  const { error } = await supabase
    .from('student_profiles')
    .delete()
    .eq('registration', registration.trim().toLowerCase())

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
    attachment: (row.attachment_name || row.storage_path) ? {
      name: row.attachment_name ?? '',
      type: row.attachment_type ?? '',
      size: row.attachment_size ?? 0,
      storagePath: row.storage_path ?? undefined,
    } : undefined,
    extractedData: row.extracted_data as unknown as Certificate['extractedData'],
  }
}

export async function upsertCertificate(
  cert: Certificate,
  profileId: string,
): Promise<Certificate> {
  const payload: Partial<DbCertificate> = {
    profile_id: profileId,
    activity_id: cert.activityId,
    description: cert.description,
    hours: cert.hours,
    date: cert.date,
    location: cert.location,
    attachment_name: cert.attachment?.name ?? null,
    attachment_type: cert.attachment?.type ?? null,
    attachment_size: cert.attachment?.size ?? null,
    storage_path: cert.attachment?.storagePath ?? null,
    extracted_data: cert.extractedData
      ? (cert.extractedData as unknown as Record<string, unknown>)
      : null,
    updated_at: new Date().toISOString(),
  }

  if (cert.id) {
    const { data, error } = await supabase
      .from('certificates')
      .update(payload)
      .eq('id', cert.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return dbCertToLocal(data as DbCertificate)
  } else {
    const { data, error } = await supabase
      .from('certificates')
      .insert({ ...payload, created_at: new Date().toISOString() })
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
    .createSignedUrl(storagePath, 60 * 60) // 1 hour

  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Erro ao obter URL')
  return data.signedUrl
}

export async function deleteAttachment(storagePath: string): Promise<void> {
  await supabase.storage.from('certificates').remove([storagePath])
}
