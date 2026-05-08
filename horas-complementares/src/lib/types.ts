export interface Warning {
  type: string
  message: string
}

export interface Student {
  name: string
  registration: string
  cpf: string
  course: string
  totalRequired: number
}

export interface StudentProfile {
  registration: string
  student: Student
  certificates: Certificate[]
  updatedAt: string
}

export interface AppState {
  student: Student
  certificates: Certificate[]
}

export type TabId = 'dashboard' | 'add' | 'certificates' | 'settings' | 'category'

export interface Category {
  id: number
  name: string
  shortName: string
  color: string
  softBg: string
  softText: string
  icon: string
}

export interface Activity {
  id: number
  categoryId: number
  name: string
  maxHours: number
  keywords: string[]
}

export interface CertificateAnalysis {
  detectedType: string
  detectedTypeLabel: string
  suggestedCategoryId?: number
  suggestedActivityId?: number
  confidence: number
  confidenceLabel: 'Alta' | 'Média' | 'Baixa'
  matchedKeywords: string[]
  evidence: string[]
  needsReview: boolean
}

export interface ExtractedData {
  text: string
  confidence: number
  suggestedActivityId?: number
  extractedHours?: number
  extractedInstitution?: string
  extractedDate?: string
  analysis?: CertificateAnalysis
}

export interface CertificateAttachment {
  name: string
  type: string
  size: number
  /** Base64 data URL — presente apenas logo após o upload local, antes de salvar */
  dataUrl?: string
  /** Caminho no Supabase Storage — preenchido após o upload remoto */
  storagePath?: string
}

export interface Certificate {
  id: number
  activityId: number
  description: string
  hours: number
  effectiveHours?: number
  excessHours?: number
  date: string
  location: string
  warnings?: Warning[]
  createdAt?: string
  updatedAt?: string
  extractedData?: ExtractedData
  attachment?: CertificateAttachment
}
