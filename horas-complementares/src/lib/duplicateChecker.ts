import { Certificate } from './types'
import { stringSimilarity, normalizeForComparison } from './stringUtils'
import { createHash } from 'crypto'

// Constante para threshold de similaridade de descrição
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.8 // 80% threshold for duplicate detection

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: 'file_hash' | 'description_similarity' | 'activity_date'
  matchingCertificate?: Certificate
}

/**
 * Extrai dados Base64 de um data URL com validação
 * @param dataUrl - Data URL no formato "data:image/png;base64,{base64data}"
 * @returns Dados Base64 ou null se inválido
 */
function extractBase64Data(dataUrl: string | undefined): string | null {
  if (!dataUrl) return null
  const parts = dataUrl.split(',')
  return parts.length === 2 ? parts[1] : null
}

/**
 * Extrai apenas a data (YYYY-MM-DD) de uma string ISO date com validação
 * @param dateString - String de data ISO (e.g., "2024-05-10T15:30:00Z")
 * @returns Data em formato YYYY-MM-DD ou null se inválida
 */
function extractDateOnly(dateString: string): string | null {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    return dateString.split('T')[0]
  } catch {
    return null
  }
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
 * Verifica se um novo certificado é duplicado em relação aos existentes.
 *
 * Usa três estratégias em ordem:
 * 1. Comparação de hash do arquivo (se attachment existe)
 * 2. Similaridade de descrição (threshold > 80%)
 * 3. Mesma atividade no mesmo dia
 *
 * @param newCert - Certificado novo sem ID
 * @param existingCerts - Lista de certificados existentes
 * @returns Resultado indicando se é duplicado, com razão e certificado correspondente
 */
export function checkDuplicate(
  newCert: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>,
  existingCerts: Certificate[],
): DuplicateCheckResult {
  // Validação de inputs
  if (!existingCerts || !Array.isArray(existingCerts)) {
    return { isDuplicate: false }
  }
  if (!newCert.description || typeof newCert.description !== 'string') {
    return { isDuplicate: false }
  }
  if (!newCert.date || typeof newCert.date !== 'string') {
    return { isDuplicate: false }
  }
  if (typeof newCert.activityId !== 'number') {
    return { isDuplicate: false }
  }

  // Estratégia 1: Hash de arquivo (se houver attachment)
  if (newCert.attachment?.dataUrl) {
    const newHash = extractBase64Data(newCert.attachment.dataUrl)
    if (newHash) {
      for (const existing of existingCerts) {
        if (existing.attachment?.dataUrl) {
          const existingHash = extractBase64Data(existing.attachment.dataUrl)
          if (existingHash && newHash === existingHash) {
            return {
              isDuplicate: true,
              reason: 'file_hash',
              matchingCertificate: existing,
            }
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
    if (similarity > DESCRIPTION_SIMILARITY_THRESHOLD) {
      return {
        isDuplicate: true,
        reason: 'description_similarity',
        matchingCertificate: existing,
      }
    }
  }

  // Estratégia 3: Mesma atividade no mesmo dia
  const newDate = extractDateOnly(newCert.date)
  if (!newDate) return { isDuplicate: false }

  for (const existing of existingCerts) {
    const existingDate = extractDateOnly(existing.date)
    if (
      existingDate &&
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
