'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ACTIVITIES, CATEGORIES, SELECTABLE_CATEGORIES } from '@/lib/data'
import { StoreType } from '@/hooks/useStore'
import { CertificateAnalysis, CertificateAttachment } from '@/lib/types'
import { analyzeCertificateText } from '@/lib/certificateAnalyzer'
import { checkDuplicate, getFileHash } from '@/lib/duplicateChecker'
import { Upload, Sparkles, CheckCircle, AlertTriangle, X, FileText, Image, Table2 } from 'lucide-react'
import OfficialModelModal from '@/components/OfficialModelModal'

const CAT_STYLES = [
  { fill: '#3b82f6', badge: 'bg-blue-50 text-blue-700' },
  { fill: '#10b981', badge: 'bg-emerald-50 text-emerald-700' },
  { fill: '#f59e0b', badge: 'bg-amber-50 text-amber-700' },
  { fill: '#8b5cf6', badge: 'bg-violet-50 text-violet-700' },
]

// ── PDF extraction ────────────────────────────────────────────────
async function extractPDFText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

  const buf = await file.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += (content.items as Array<{ str: string }>).map(item => item.str).join(' ') + '\n'
  }
  return text
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => resolve(event.target?.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// ── Keyword helpers ───────────────────────────────────────────────
function norm(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

function findBestActivity(text: string) {
  const t = norm(text)
  let best = null
  let topScore = 0
  for (const act of ACTIVITIES) {
    const score = act.keywords.reduce((s, kw) => s + (t.includes(kw) ? 1 : 0), 0)
    if (score > topScore) { topScore = score; best = act }
  }
  return topScore >= 1 ? best : null
}

function extractHours(text: string): number | null {
  const t = norm(text)
  const patterns = [
    /(\d+)\s*horas?/,
    /carga\s*hor[aá]ria[:\s]+(\d+)/,
    /durac[aã]o[:\s]+(\d+)/,
    /total[:\s]+(\d+)\s*h/,
  ]
  for (const p of patterns) {
    const m = t.match(p)
    if (m) { const v = parseInt(m[1]); if (v > 0 && v <= 2000) return v }
  }
  return null
}

function extractDate(text: string): string | null {
  let m = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function extractDescription(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 8 && l.length < 120)
  for (const l of lines.slice(0, 12)) {
    const lo = l.toLowerCase()
    if (!lo.includes('cnpj') && !lo.includes('cpf') && !lo.includes('rua ') && !lo.includes('avenida')) {
      return l.slice(0, 100)
    }
  }
  return ''
}

// ── Form State ────────────────────────────────────────────────────
interface FormState {
  categoryId: string
  activityId: string
  description: string
  hours: string
  date: string
  location: string
}

const EMPTY_FORM: FormState = {
  categoryId: '', activityId: '', description: '', hours: '', date: '', location: ''
}

interface AutoSuggestion {
  categoryId: number
  activityId: number
  hours?: number
  analysis?: CertificateAnalysis
}

interface AddCertificateProps {
  store: StoreType
  onSuccess: () => void
}

export default function AddCertificate({ store, onSuccess }: AddCertificateProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [suggestion, setSuggestion] = useState<AutoSuggestion | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<CertificateAttachment | null>(null)
  const [analysis, setAnalysis] = useState<CertificateAnalysis | null>(null)
  const [status, setStatus] = useState<{ type: 'loading' | 'ok' | 'warn'; msg: string } | null>(null)
  const [showLimitDialog, setShowLimitDialog] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDuplicateFile, setIsDuplicateFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showModel, setShowModel] = useState(false)
  const [expandPreview, setExpandPreview] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)

  // Blob URLs are more reliable than data: URIs for <object> PDF rendering in Chrome
  useEffect(() => {
    return () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl) }
  }, [pdfPreviewUrl])
  const fileRef = useRef<HTMLInputElement>(null)

  const setField = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const checkDuplicateAttachment = useCallback((nextAttachment: CertificateAttachment) => {
    const duplicateCheck = checkDuplicate(
      {
        activityId: parseInt(form.activityId) || 0,
        description: form.description.trim(),
        hours: parseInt(form.hours) || 0,
        date: form.date,
        location: form.location.trim(),
        attachment: nextAttachment,
      },
      store.state?.certificates ?? []
    )

    if (duplicateCheck.isDuplicate) {
      setIsDuplicateFile(true)
      setStatus({
        type: 'warn',
        msg: '⚠ Este mesmo arquivo já foi enviado anteriormente.'
      })
      return true
    }

    setIsDuplicateFile(false)
    return false
  }, [form.activityId, form.date, form.description, form.hours, form.location, store.state])

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    setStatus({ type: 'loading', msg: 'Processando arquivo...' })
    setExtractedText(null)
    setPreviewSrc(null)
    setAttachment(null)
    setAnalysis(null)
    setPdfPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })

    if (ext === 'pdf') {
      try {
        const dataUrl = await fileToDataUrl(file)
        const fileHash = await getFileHash(file)
        const text = await extractPDFText(file)
        setExtractedText(text.trim().slice(0, 1500))
        setPdfPreviewUrl(URL.createObjectURL(file))
        const nextAttachment = { name: file.name, type: file.type || 'application/pdf', size: file.size, fileHash, dataUrl }
        setAttachment(nextAttachment)
        // Auto-fill
        const detectedAnalysis = analyzeCertificateText(text)
        setAnalysis(detectedAnalysis)
        const bestAct = detectedAnalysis.suggestedActivityId
          ? ACTIVITIES.find(activity => activity.id === detectedAnalysis.suggestedActivityId) ?? findBestActivity(text)
          : findBestActivity(text)
        const hours = extractHours(text)
        const date = extractDate(text)
        const desc = extractDescription(text)
        const t = norm(text)
        const loc = t.includes('univassouras') || t.includes('universidade de vassouras') ? 'UNIVASSOURAS' : ''

        setForm(prev => ({
          ...prev,
          description: desc || prev.description,
          hours: hours ? String(hours) : prev.hours,
          date: date || prev.date,
          location: loc || prev.location,
          categoryId: bestAct ? String(bestAct.categoryId) : prev.categoryId,
          activityId: bestAct ? String(bestAct.id) : prev.activityId,
        }))
        if (bestAct || hours) {
          setSuggestion({
            categoryId: bestAct?.categoryId ?? detectedAnalysis.suggestedCategoryId ?? -1,
            activityId: bestAct?.id ?? -1,
            hours: hours ?? undefined,
            analysis: detectedAnalysis,
          })
        }
        if (!checkDuplicateAttachment(nextAttachment)) {
          setStatus({ type: 'ok', msg: 'PDF processado com sucesso! Verifique os dados antes de salvar.' })
        }
      } catch {
        setIsDuplicateFile(false)
        setStatus({ type: 'warn', msg: 'Não foi possível extrair o texto. Preencha os dados manualmente.' })
      }
    } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      try {
        const [dataUrl, fileHash] = await Promise.all([fileToDataUrl(file), getFileHash(file)])
        setPreviewSrc(dataUrl)
        const nextAttachment = { name: file.name, type: file.type || `image/${ext}`, size: file.size, fileHash, dataUrl }
        setAttachment(nextAttachment)
        if (!checkDuplicateAttachment(nextAttachment)) {
          setStatus({ type: 'ok', msg: 'Imagem carregada. Preencha os dados abaixo.' })
        }
      } catch {
        setIsDuplicateFile(false)
        setStatus({ type: 'warn', msg: 'Não foi possível carregar a imagem. Tente outro arquivo.' })
      }
    } else {
      setIsDuplicateFile(false)
      setStatus({ type: 'warn', msg: 'Formato não suportado. Use PDF, PNG ou JPG.' })
    }
  }, [checkDuplicateAttachment])

  const filteredActivities = ACTIVITIES.filter(a => a.categoryId === parseInt(form.categoryId))
  const selectedActivity = ACTIVITIES.find(a => a.id === parseInt(form.activityId))
  const submittedForAct = selectedActivity ? store.getActivitySubmitted(selectedActivity.id) : 0
  const remainingCap = selectedActivity ? Math.max(0, selectedActivity.maxHours - submittedForAct) : null
  const hoursNum = parseInt(form.hours) || 0
  const willExceed = selectedActivity && hoursNum > 0 && hoursNum + submittedForAct > selectedActivity.maxHours

  const saveCertificate = async () => {
    const actId = parseInt(form.activityId)
    if (!actId) return
    setSaving(true)
    const saved = await store.addCertificate({
      activityId: actId,
      description: form.description.trim(),
      hours: parseInt(form.hours) || 0,
      date: form.date,
      location: form.location.trim(),
      attachment: attachment ?? undefined,
      extractedData: extractedText
        ? {
            text: extractedText,
            confidence: suggestion ? 0.75 : 0.35,
            suggestedActivityId: suggestion?.activityId && suggestion.activityId > 0 ? suggestion.activityId : undefined,
            extractedHours: suggestion?.hours,
            extractedInstitution: form.location.trim() || undefined,
            extractedDate: form.date || undefined,
            analysis: analysis ?? undefined,
          }
        : undefined,
    })
    setSaving(false)
    if (!saved) return
    setForm(EMPTY_FORM)
    setSuggestion(null)
    setExtractedText(null)
    setPreviewSrc(null)
    setAttachment(null)
    setAnalysis(null)
    setPdfPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setStatus(null)
    setShowLimitDialog(false)
    setIsDuplicateFile(false)
    onSuccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    // Validar duplicata
    const certificatesList = store.state?.certificates ?? []
    const duplicateCheck = checkDuplicate(
      {
        activityId: parseInt(form.activityId),
        description: form.description.trim(),
        hours: parseInt(form.hours) || 0,
        date: form.date,
        location: form.location.trim(),
        attachment: attachment ?? undefined,
      },
      certificatesList
    )

    if (duplicateCheck.isDuplicate) {
      setIsDuplicateFile(true)
      setStatus({
        type: 'warn',
        msg: '⚠ Este mesmo arquivo já foi enviado anteriormente.'
      })
      return
    }

    if (willExceed) {
      setShowLimitDialog(true)
      return
    }
    await saveCertificate()
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setSuggestion(null)
    setExtractedText(null)
    setPreviewSrc(null)
    setAttachment(null)
    setAnalysis(null)
    setPdfPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setStatus(null)
    setShowLimitDialog(false)
    setIsDuplicateFile(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Adicionar Certificado</h1>
          <p className="text-sm text-gray-500 mt-0.5">Faça upload do PDF ou preencha os campos manualmente</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModel(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-vinho-700 border border-vinho-200 rounded-lg px-3 py-1.5 hover:bg-vinho-50 transition-colors flex-shrink-0"
        >
          <Table2 size={13} />
          Ver modelo oficial
        </button>
      </div>

      <OfficialModelModal open={showModel} onClose={() => setShowModel(false)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column: upload */}
        <div className="space-y-4">
          {/* Upload zone */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Upload do Arquivo</div>
            <div
              role="button"
              tabIndex={0}
              aria-label="Selecionar arquivo de certificado. Clique ou arraste PDF, PNG ou JPG aqui."
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault(); setIsDragging(false)
                const f = e.dataTransfer.files[0]; if (f) handleFile(f)
              }}
              className={[
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-vinho-400 bg-vinho-50'
                  : 'border-gray-200 hover:border-vinho-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <div className="w-12 h-12 rounded-xl bg-vinho-50 flex items-center justify-center mx-auto mb-3">
                <Upload size={22} className="text-vinho-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                <span className="text-vinho-600">Clique para selecionar</span> ou arraste aqui
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF · PNG · JPG — extração automática de texto</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />

            {/* Status */}
            {status && (
              <div className={[
                'flex items-start gap-2.5 mt-3 px-4 py-3 rounded-lg text-sm',
                status.type === 'loading' ? 'bg-slate-50 text-slate-600' :
                status.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
              ].join(' ')}>
                {status.type === 'loading' && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />}
                {status.type === 'ok' && <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
                {status.type === 'warn' && <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
                <span>{status.msg}</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {(extractedText || previewSrc || pdfPreviewUrl) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                {attachment?.type === 'application/pdf' || extractedText
                  ? <FileText size={14} className="text-vinho-500" />
                  : <Image size={14} className="text-vinho-500" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Preview do certificado
                </span>
              </div>
              {pdfPreviewUrl && (
                <object
                  data={pdfPreviewUrl}
                  type="application/pdf"
                  className="w-full h-64 rounded-lg border border-gray-200 mb-3"
                >
                  <p className="text-xs text-gray-400 p-3">
                    Não foi possível pré-visualizar o PDF.{' '}
                    <a href={pdfPreviewUrl} target="_blank" rel="noreferrer" className="text-vinho-600 underline">
                      Abrir em nova aba
                    </a>
                  </p>
                </object>
              )}
              {previewSrc && (
                <button
                  type="button"
                  onClick={() => setExpandPreview(true)}
                  className="block mb-3"
                >
                  <img src={previewSrc} alt="certificado" className="max-w-full max-h-48 rounded-lg object-contain hover:opacity-90 transition-opacity" />
                </button>
              )}
              {extractedText && (
                <details className="group">
                  <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600">
                    Ver texto extraído
                  </summary>
                  <div className="bg-gray-50 rounded-lg p-3 mt-2 text-xs text-gray-500 leading-relaxed max-h-40 overflow-y-auto font-mono break-words">
                    {extractedText}
                  </div>
                </details>
              )}
              {suggestion && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-vinho-50 rounded-lg">
                  <Sparkles size={13} className="text-vinho-500 flex-shrink-0" />
                  <span className="text-xs text-vinho-600 font-medium">
                    Dados preenchidos automaticamente — revise antes de salvar
                  </span>
                </div>
              )}
              {analysis && (
                <div className="mt-3 rounded-lg border border-vinho-100 bg-vinho-50/60 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-vinho-500">Análise do certificado</span>
                    <span className={[
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      analysis.confidenceLabel === 'Alta' ? 'bg-emerald-50 text-emerald-700' :
                      analysis.confidenceLabel === 'Média' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
                    ].join(' ')}>
                      {analysis.confidenceLabel}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{analysis.detectedTypeLabel}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {analysis.suggestedCategoryId !== undefined && `Categoria sugerida: ${CATEGORIES[analysis.suggestedCategoryId]?.shortName}`}
                    {analysis.suggestedActivityId && ` · Atividade: ${ACTIVITIES.find(a => a.id === analysis.suggestedActivityId)?.name}`}
                  </div>
                  {analysis.matchedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {analysis.matchedKeywords.slice(0, 8).map(keyword => (
                        <span key={keyword} className="text-[11px] font-medium text-vinho-700 bg-white px-2 py-0.5 rounded-full">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5">Dados do Certificado</div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Categoria
                {suggestion?.activityId !== undefined && suggestion.activityId >= 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-vinho-600 bg-vinho-50 px-2 py-0.5 rounded-full">
                    <Sparkles size={10} /> sugestão automática
                  </span>
                )}
              </label>
              <select
                required
                value={form.categoryId}
                onChange={e => { setField('categoryId', e.target.value); setField('activityId', '') }}
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 transition-all outline-none"
              >
                <option value="">Selecione a categoria...</option>
                {SELECTABLE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            {/* Activity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Atividade</label>
              <select
                required
                value={form.activityId}
                onChange={e => setField('activityId', e.target.value)}
                disabled={!form.categoryId}
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {form.categoryId ? 'Selecione a atividade...' : 'Selecione a categoria primeiro'}
                </option>
                {filteredActivities.map(act => (
                  <option key={act.id} value={act.id}>{act.name} (máx. {act.maxHours}h)</option>
                ))}
              </select>
              {selectedActivity && (
                <div className="text-xs text-gray-400 mt-1.5">
                  Limite: <span className="font-semibold text-gray-600">{selectedActivity.maxHours}h</span>
                  {submittedForAct > 0 && (
                    <span className="ml-2">
                      · já registrado: <span className="font-semibold text-gray-600">{submittedForAct}h</span>
                      {remainingCap !== null && remainingCap > 0 && (
                        <span> · disponível: <span className="font-semibold text-emerald-600">{remainingCap}h</span></span>
                      )}
                      {remainingCap === 0 && (
                        <span className="text-red-500 ml-1 font-semibold">· limite atingido</span>
                      )}
                    </span>
                  )}
                </div>
              )}
              {willExceed && (
                <div className="mt-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  ⚠ As horas inseridas excedem o limite. O excedente não será contabilizado.
                </div>
              )}
            </div>

            {/* Description */}
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</span>
              <input
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Ex: Curso de Python para Iniciantes"
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 transition-all outline-none"
              />
            </label>

            {/* Hours & Date */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Horas</span>
                <input
                  required
                  type="number"
                  min="1"
                  max="2000"
                  value={form.hours}
                  onChange={e => setField('hours', e.target.value)}
                  placeholder="Ex: 20"
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 transition-all outline-none"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Data</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 transition-all outline-none"
                />
              </label>
            </div>

            {/* Institution */}
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Instituição / Local</span>
              <input
                value={form.location}
                onChange={e => setField('location', e.target.value)}
                placeholder="Ex: UNIVASSOURAS"
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 transition-all outline-none"
              />
            </label>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 min-h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpar
              </button>
              <button
                type="submit"
                disabled={!form.activityId || !form.hours || isDuplicateFile || saving}
                className="flex-1 min-h-10 rounded-lg bg-vinho-600 hover:bg-vinho-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm shadow-vinho-200 flex items-center justify-center gap-2"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                  : isDuplicateFile ? 'Arquivo duplicado' : 'Salvar certificado'
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Limit exceeded dialog */}
      {showLimitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <button onClick={() => setShowLimitDialog(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Limite de horas excedido</h3>
            <p className="text-sm text-gray-500 mb-5">
              Você está inserindo mais horas do que o permitido para esta atividade. O excedente
              será registrado mas <strong>não será contabilizado</strong> no total.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLimitDialog(false)}
                className="flex-1 min-h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCertificate}
                disabled={saving}
                className="flex-1 min-h-10 rounded-lg bg-vinho-600 hover:bg-vinho-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                  : 'Salvar assim mesmo'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {expandPreview && previewSrc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          onClick={() => setExpandPreview(false)}
        >
          <img src={previewSrc} alt="certificado ampliado" className="max-w-full max-h-[85vh] rounded-lg" />
          <button
            type="button"
            onClick={() => setExpandPreview(false)}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
