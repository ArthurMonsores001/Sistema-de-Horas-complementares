import { ACTIVITIES, CATEGORIES } from './data'
import { CertificateAnalysis } from './types'

interface CertificateTypeRule {
  id: string
  label: string
  preferredCategoryId?: number
  keywords: string[]
}

const TYPE_RULES: CertificateTypeRule[] = [
  {
    id: 'curso',
    label: 'Curso',
    preferredCategoryId: 1,
    keywords: ['curso', 'formacao', 'capacitação', 'capacitacao', 'trilha', 'concluiu', 'conclusao', 'aula', 'módulo', 'modulo'],
  },
  {
    id: 'palestra',
    label: 'Palestra',
    preferredCategoryId: 1,
    keywords: ['palestra', 'webinar', 'mesa redonda', 'talk', 'conferência', 'conferencia'],
  },
  {
    id: 'evento_academico',
    label: 'Evento acadêmico',
    preferredCategoryId: 1,
    keywords: ['evento', 'semana academica', 'jornada', 'congresso', 'seminario', 'seminário', 'simpósio', 'simposio', 'forum', 'fórum', 'enic'],
  },
  {
    id: 'oficina',
    label: 'Workshop / Oficina',
    preferredCategoryId: 1,
    keywords: ['workshop', 'oficina', 'laboratorio pratico', 'laboratório prático', 'minicurso'],
  },
  {
    id: 'extensao',
    label: 'Projeto de extensão',
    preferredCategoryId: 1,
    keywords: ['extensao', 'extensão', 'projeto de extensao', 'projeto de extensão', 'mostra extensao', 'mostra extensão'],
  },
  {
    id: 'monitoria',
    label: 'Monitoria',
    preferredCategoryId: 1,
    keywords: ['monitoria', 'monitor', 'bolsa monitoria'],
  },
  {
    id: 'iniciacao_cientifica',
    label: 'Iniciação científica',
    preferredCategoryId: 1,
    keywords: ['iniciação científica', 'iniciacao cientifica', 'pibic', 'pibiti', 'pesquisa'],
  },
  {
    id: 'certificacao',
    label: 'Certificação profissional',
    preferredCategoryId: 3,
    keywords: ['certificacao', 'certificação', 'aws', 'azure', 'google cloud', 'cisco', 'oracle', 'microsoft', 'exame'],
  },
  {
    id: 'visita_tecnica',
    label: 'Visita técnica',
    preferredCategoryId: 2,
    keywords: ['visita tecnica', 'visita técnica', 'visita empresa', 'visita campo'],
  },
  {
    id: 'voluntariado',
    label: 'Trabalho voluntário',
    preferredCategoryId: 3,
    keywords: ['voluntario', 'voluntário', 'voluntaria', 'voluntária', 'ong', 'ação social', 'acao social'],
  },
  {
    id: 'competicao',
    label: 'Competição acadêmica',
    preferredCategoryId: 3,
    keywords: ['hackathon', 'maratona', 'competição', 'competicao', 'olimpíada', 'olimpiada', 'concurso'],
  },
  {
    id: 'empreendedorismo',
    label: 'Empreendedorismo e inovação',
    preferredCategoryId: 2,
    keywords: ['empreendedorismo', 'inovação', 'inovacao', 'startup', 'desafio inovação', 'desafio inovacao'],
  },
]

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

function unique(items: string[]) {
  return Array.from(new Set(items)).slice(0, 14)
}

function keywordHits(text: string, keywords: string[]) {
  const normalizedKeywords = keywords.map(normalize)
  return keywords.filter((keyword, index) => text.includes(normalizedKeywords[index]))
}

function confidenceLabel(confidence: number): CertificateAnalysis['confidenceLabel'] {
  if (confidence >= 0.72) return 'Alta'
  if (confidence >= 0.45) return 'Média'
  return 'Baixa'
}

export function analyzeCertificateText(rawText: string): CertificateAnalysis {
  const text = normalize(rawText)
  const typeScores = TYPE_RULES.map(rule => {
    const hits = keywordHits(text, rule.keywords)
    return { rule, hits, score: hits.length }
  }).sort((a, b) => b.score - a.score)

  const bestType = typeScores[0]
  const activityScores = ACTIVITIES
    .filter(activity => activity.categoryId !== 4)
    .map(activity => {
    const hits = keywordHits(text, activity.keywords)
    const typeBonus = bestType?.rule.preferredCategoryId === activity.categoryId ? 0.35 : 0
    return { activity, hits, score: hits.length + typeBonus }
  }).sort((a, b) => b.score - a.score)

  const bestActivity = activityScores[0]
  const suggestedActivity = bestActivity?.score > 0 ? bestActivity.activity : undefined
  const suggestedCategoryId = suggestedActivity?.categoryId ?? bestType?.rule.preferredCategoryId
  const matchedKeywords = unique([...(bestType?.hits ?? []), ...(bestActivity?.hits ?? [])])
  const evidence = [
    bestType?.score ? `Tipo identificado por ${bestType.hits.length} palavra(s)-chave.` : '',
    suggestedActivity ? `Atividade sugerida: ${suggestedActivity.name}.` : '',
    suggestedCategoryId !== undefined ? `Categoria sugerida: ${CATEGORIES[suggestedCategoryId]?.shortName}.` : '',
    text.includes('carga horaria') || text.includes('carga horária') || text.includes('horas') ? 'Carga horária encontrada no texto.' : '',
    text.includes('certificado') ? 'Documento menciona certificado.' : '',
    text.includes('particip') ? 'Documento menciona participação.' : '',
  ].filter(Boolean)

  const typeScore = Math.min(1, (bestType?.score ?? 0) / 4)
  const activityScore = Math.min(1, Math.max(0, (bestActivity?.score ?? 0)) / 3)
  const evidenceScore = Math.min(1, evidence.length / 5)
  const confidence = Math.round(((typeScore * 0.4) + (activityScore * 0.4) + (evidenceScore * 0.2)) * 100) / 100

  return {
    detectedType: bestType?.score ? bestType.rule.id : 'indefinido',
    detectedTypeLabel: bestType?.score ? bestType.rule.label : 'Não identificado',
    suggestedCategoryId,
    suggestedActivityId: suggestedActivity?.id,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    matchedKeywords,
    evidence,
    needsReview: confidence < 0.72 || !suggestedActivity,
  }
}
