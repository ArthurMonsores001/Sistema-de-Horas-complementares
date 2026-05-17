import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types that mirror the DB rows ─────────────────────────────────

export interface DbProfile {
  id: string
  user_id: string
  registration: string
  name: string
  cpf: string
  course: string
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
  created_at: string
  updated_at: string
}
