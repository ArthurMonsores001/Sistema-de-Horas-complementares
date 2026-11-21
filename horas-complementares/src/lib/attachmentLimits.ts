// Limites e compressao de anexos. O limite real e imposto tambem no bucket
// (supabase/rls-policies.sql); aqui serve para avisar o aluno antes do upload.

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // PDF e imagem ja comprimida
export const MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024 // foto bruta, antes de comprimir

const MAX_IMAGE_SIDE = 1600
const JPEG_QUALITY = 0.8
const SKIP_COMPRESSION_BELOW = 300 * 1024

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Reduz a imagem para no maximo 1600 px no lado maior e salva como JPEG.
 * Devolve o original se ja for pequeno, se o navegador nao conseguir decodificar
 * ou se o resultado ficar maior que o original. Imagem nao e lida por OCR
 * (preenchimento manual), entao a perda de qualidade nao afeta a analise.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size <= SKIP_COMPRESSION_BELOW) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }

    // JPEG nao tem transparencia: PNG com fundo transparente ficaria preto
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
