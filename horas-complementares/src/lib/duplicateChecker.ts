import { Certificate } from './types'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: 'file_hash' | 'metadata'
  matchingCertificate?: Certificate
}

/**
 * Calcula hash SHA-256 de um arquivo no browser.
 */
export async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Procura certificado já salvo com o mesmo hash do arquivo.
 */
export function checkDuplicate(
  newCert: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>,
  existingCerts: Certificate[],
): DuplicateCheckResult {
  if (!existingCerts || !Array.isArray(existingCerts)) {
    return { isDuplicate: false }
  }
  const newHash = newCert.attachment?.fileHash

  if (newHash) {
    for (const existing of existingCerts) {
      if (existing.attachment?.fileHash === newHash) {
        return { isDuplicate: true, reason: 'file_hash', matchingCertificate: existing }
      }
    }
    return { isDuplicate: false }
  }

  // Fallback por metadados quando não há arquivo anexo
  for (const existing of existingCerts) {
    if (
      existing.activityId === newCert.activityId &&
      existing.date === newCert.date &&
      existing.hours === newCert.hours
    ) {
      return { isDuplicate: true, reason: 'metadata', matchingCertificate: existing }
    }
  }

  return { isDuplicate: false }
}
