import { Certificate } from './types'
import { stringSimilarity, normalizeForComparison } from './stringUtils'
import { createHash } from 'crypto'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: string // "file_hash" | "description_similarity" | "activity_date"
  matchingCertificate?: Certificate
}

/**
 * Calcula hash SHA-256 de um arquivo (Buffer)
 */
export function getFileHash(fileData: Uint8Array): string {
  // Nota: crypto.subtle é disponível em browsers modernos
  // Para Node.js backend, usar crypto module
  const hashBuffer = createHash('sha256').update(Buffer.from(fileData)).digest()
  return hashBuffer.toString('hex')
}

/**
 * Verifica se um novo certificado é duplicado em relação aos existentes
 */
export function checkDuplicate(
  newCert: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>,
  existingCerts: Certificate[],
): DuplicateCheckResult {
  // Estratégia 1: Hash de arquivo (se houver attachment)
  if (newCert.attachment?.dataUrl) {
    const newHash = newCert.attachment.dataUrl.split(',')[1] // Pega só a parte base64
    for (const existing of existingCerts) {
      if (existing.attachment?.dataUrl) {
        const existingHash = existing.attachment.dataUrl.split(',')[1]
        if (newHash === existingHash) {
          return {
            isDuplicate: true,
            reason: 'file_hash',
            matchingCertificate: existing,
          }
        }
      }
    }
  }

  // Estratégia 2: Descrição similar (>80%)
  const normalizedDesc = normalizeForComparison(newCert.description)
  for (const existing of existingCerts) {
    const existingDesc = normalizeForComparison(existing.description)
    const similarity = stringSimilarity(normalizedDesc, existingDesc)
    if (similarity > 0.8) {
      return {
        isDuplicate: true,
        reason: 'description_similarity',
        matchingCertificate: existing,
      }
    }
  }

  // Estratégia 3: Mesma atividade no mesmo dia
  const newDate = newCert.date.split('T')[0] // YYYY-MM-DD
  for (const existing of existingCerts) {
    const existingDate = existing.date.split('T')[0]
    if (
      existing.activityId === newCert.activityId &&
      existingDate === newDate
    ) {
      return {
        isDuplicate: true,
        reason: 'activity_date',
        matchingCertificate: existing,
      }
    }
  }

  return { isDuplicate: false }
}
