import { Certificate, StudentProfile } from './types'

export interface SharedFileOwner {
  name: string
  registration: string
}

/**
 * Arquivos enviados por mais de um aluno: hash -> quem enviou.
 * Só entram hashes presentes em 2 ou mais perfis. Aviso para o supervisor, não bloqueio.
 */
export function findSharedFiles(profiles: StudentProfile[]): Map<string, SharedFileOwner[]> {
  const owners = new Map<string, SharedFileOwner[]>()
  for (const profile of profiles) {
    const hashes = new Set(profile.certificates.map(c => c.attachment?.fileHash).filter(Boolean) as string[])
    hashes.forEach(hash => {
      const list = owners.get(hash) ?? []
      list.push({ name: profile.student.name, registration: profile.registration })
      owners.set(hash, list)
    })
  }
  owners.forEach((list, hash) => { if (list.length < 2) owners.delete(hash) })
  return owners
}

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
