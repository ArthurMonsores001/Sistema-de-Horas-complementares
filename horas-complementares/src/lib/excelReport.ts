import * as XLSX from 'xlsx'
import { ACTIVITIES, CATEGORIES } from './data'
import { AppState, Certificate } from './types'

function safeSheetName(name: string) {
  return name.replace(/[:\\/?*[\]]/g, '').slice(0, 31)
}

function formatDate(date: string) {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return day && month && year ? `${day}/${month}/${year}` : date
}

function certificateUsage(certificates: Certificate[]) {
  const usedByActivity: Record<number, number> = {}
  const usage: Record<number, { effectiveHours: number; excessHours: number }> = {}

  for (const cert of [...certificates].sort((a, b) => a.id - b.id)) {
    const activity = ACTIVITIES.find(item => item.id === cert.activityId)
    const limit = activity?.maxHours ?? cert.hours
    const alreadyUsed = usedByActivity[cert.activityId] ?? 0
    const available = Math.max(0, limit - alreadyUsed)
    const effectiveHours = Math.min(cert.hours, available)
    const excessHours = Math.max(0, cert.hours - effectiveHours)

    usedByActivity[cert.activityId] = alreadyUsed + effectiveHours
    usage[cert.id] = { effectiveHours, excessHours }
  }

  return usage
}

function applyColumns(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map(width => ({ wch: width }))
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name))
  return sheet
}

export function exportStudentExcelReport(state: AppState) {
  const { student, certificates } = state
  const workbook = XLSX.utils.book_new()
  const usageById = certificateUsage(certificates)
  const totalSubmitted = certificates.reduce((sum, cert) => sum + cert.hours, 0)
  const totalEffective = certificates.reduce((sum, cert) => sum + (usageById[cert.id]?.effectiveHours ?? cert.hours), 0)
  const totalExcess = Math.max(0, totalSubmitted - totalEffective)
  const required = student.totalRequired || 120
  const progress = required > 0 ? Math.min(100, Math.round((totalEffective / required) * 100)) : 0

  const summarySheet = appendSheet(workbook, 'Resumo', [
    ['Relatório de Horas Complementares'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    [],
    ['Aluno', student.name || 'Não informado'],
    ['Matrícula', student.registration || 'Não informada'],
    ['Curso', student.course || 'Não informado'],
    ['CPF', student.cpf || ''],
    ['RG', student.rg || ''],
    [],
    ['Indicador', 'Valor'],
    ['Total necessário', required],
    ['Horas enviadas', totalSubmitted],
    ['Horas válidas', totalEffective],
    ['Horas excedentes', totalExcess],
    ['Progresso (%)', progress],
    ['Certificados cadastrados', certificates.length],
  ])
  applyColumns(summarySheet, [28, 36])

  const categoryRows: Array<Array<string | number>> = [
    ['Categoria', 'Horas enviadas', 'Horas válidas', 'Horas excedentes', 'Limite somado das atividades', 'Atividades usadas'],
  ]
  for (const category of CATEGORIES) {
    const activityIds = ACTIVITIES.filter(activity => activity.categoryId === category.id).map(activity => activity.id)
    const categoryCerts = certificates.filter(cert => activityIds.includes(cert.activityId))
    const submitted = categoryCerts.reduce((sum, cert) => sum + cert.hours, 0)
    const effective = categoryCerts.reduce((sum, cert) => sum + (usageById[cert.id]?.effectiveHours ?? cert.hours), 0)
    const max = ACTIVITIES.filter(activity => activity.categoryId === category.id).reduce((sum, activity) => sum + activity.maxHours, 0)
    const usedActivities = new Set(categoryCerts.map(cert => cert.activityId)).size
    categoryRows.push([category.name, submitted, effective, submitted - effective, max, usedActivities])
  }
  const categorySheet = appendSheet(workbook, 'Categorias', categoryRows)
  applyColumns(categorySheet, [38, 16, 16, 18, 28, 18])

  const activityRows: Array<Array<string | number>> = [
    ['Grupo da categoria', 'Categoria completa', 'Atividade', 'Limite', 'Horas enviadas', 'Horas válidas', 'Horas excedentes', 'Certificados'],
  ]
  for (const activity of ACTIVITIES) {
    const activityCerts = certificates.filter(cert => cert.activityId === activity.id)
    const submitted = activityCerts.reduce((sum, cert) => sum + cert.hours, 0)
    const effective = Math.min(submitted, activity.maxHours)
    const category = CATEGORIES[activity.categoryId]
    if (submitted > 0) {
      activityRows.push([
        category?.shortName ?? '',
        category?.name ?? '',
        activity.name,
        activity.maxHours,
        submitted,
        effective,
        Math.max(0, submitted - effective),
        activityCerts.length,
      ])
    }
  }
  const activitySheet = appendSheet(workbook, 'Atividades', activityRows)
  applyColumns(activitySheet, [20, 38, 52, 12, 16, 16, 18, 14])

  const certificateRows: Array<Array<string | number>> = [
    [
      'Data',
      'Descrição',
      'Instituição',
      'Grupo da categoria',
      'Categoria/Área registrada',
      'Categoria sugerida pela análise',
      'Atividade',
      'Horas enviadas',
      'Horas válidas',
      'Horas excedentes',
      'Tipo detectado',
      'Confiança',
      'Palavras-chave',
      'Arquivo',
    ],
  ]

  for (const cert of [...certificates].sort((a, b) => (a.date || '').localeCompare(b.date || ''))) {
    const activity = ACTIVITIES.find(item => item.id === cert.activityId)
    const category = activity ? CATEGORIES[activity.categoryId] : null
    const usage = usageById[cert.id] ?? { effectiveHours: cert.hours, excessHours: 0 }
    const analysis = cert.extractedData?.analysis
    const suggestedCategory = analysis?.suggestedCategoryId !== undefined ? CATEGORIES[analysis.suggestedCategoryId] : null

    certificateRows.push([
      formatDate(cert.date),
      cert.description,
      cert.location,
      category?.shortName ?? '',
      category?.name ?? '',
      suggestedCategory?.name ?? '',
      activity?.name ?? '',
      cert.hours,
      usage.effectiveHours,
      usage.excessHours,
      analysis?.detectedTypeLabel ?? '',
      analysis ? `${analysis.confidenceLabel} (${Math.round(analysis.confidence * 100)}%)` : '',
      analysis?.matchedKeywords.join(', ') ?? '',
      cert.attachment?.name ?? '',
    ])
  }
  const certificateSheet = appendSheet(workbook, 'Certificados', certificateRows)
  applyColumns(certificateSheet, [14, 42, 24, 20, 38, 38, 48, 16, 16, 18, 24, 18, 36, 28])

  const fileBase = student.registration || student.name || 'horas-complementares'
  const fileName = `relatorio-horas-${fileBase.replace(/[^a-z0-9_-]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, fileName, { compression: true })
}
