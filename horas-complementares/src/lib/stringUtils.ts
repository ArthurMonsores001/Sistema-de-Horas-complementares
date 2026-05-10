/**
 * Calcula similaridade entre duas strings (0-1)
 * Usa Levenshtein distance normalizado
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const editDistance = getEditDistance(s1, s2)
  return 1 - (editDistance / Math.max(s1.length, s2.length))
}

/**
 * Calcula edit distance usando Wagner-Fischer algorithm
 * Retorna número de edições (inserção, deleção, substituição) necessárias
 * para transformar s1 em s2. Complexidade: O(m*n)
 */
function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = Array(s2.length + 1)
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

/**
 * Normaliza texto para comparação (remove acentos, espaços extras)
 */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}
