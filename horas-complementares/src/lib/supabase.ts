import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Lido antes do createClient, que consome e limpa o hash da URL do link de e-mail
const urlHash = typeof window !== 'undefined' ? window.location.hash : ''
export const openedRecoveryLink = urlHash.includes('type=recovery')
export const openedExpiredLink = urlHash.includes('error_code=otp_expired')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types that mirror the DB rows ─────────────────────────────────

export interface DbProfile {
  id: string
  user_id: string
  registration: string
  name: string
  cpf?: string
  course: string
  engineering_type: string | null
  total_required: number
  updated_at: string
}

export interface DbCertificate {
  id: number
  profile_id: string
  activity_id: number
  description: string
  hours: number
  date: string
  location: string
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
  file_hash: string | null
  storage_path: string | null
  extracted_data: Record<string, unknown> | null
  status: string
  supervisor_comment: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface DbUserRole {
  id: string
  user_id: string
  role: string
  created_at: string
}
