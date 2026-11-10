'use client'

import { CATEGORIES, ACTIVITIES } from '@/lib/data'
import { X, Table2 } from 'lucide-react'

interface OfficialModelModalProps {
  open: boolean
  onClose: () => void
}

const CAT_TINT = [
  { row: 'bg-blue-50', text: 'text-blue-700' },
  { row: 'bg-emerald-50', text: 'text-emerald-700' },
  { row: 'bg-amber-50', text: 'text-amber-700' },
  { row: 'bg-violet-50', text: 'text-violet-700' },
]

export default function OfficialModelModal({ open, onClose }: OfficialModelModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 backdrop-blur-sm z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Table2 size={17} className="text-vinho-600" />
            <h2 className="text-base font-bold text-gray-900">Modelo oficial de integralização</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="border border-gray-200 px-2 py-2 text-left w-6"></th>
                <th className="border border-gray-200 px-2 py-2 text-left w-8">Item</th>
                <th className="border border-gray-200 px-2 py-2 text-left">Macroatividade</th>
                <th className="border border-gray-200 px-2 py-2 text-right w-20">Horas máx.</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat, catIndex) => {
                const acts = ACTIVITIES.filter(a => a.categoryId === cat.id)
                const total = acts.reduce((sum, a) => sum + a.maxHours, 0)
                const tint = CAT_TINT[catIndex]
                return acts.map((act, i) => (
                  <tr key={act.id} className={tint.row}>
                    {i === 0 && (
                      <td
                        rowSpan={acts.length}
                        className={`border border-gray-200 px-1.5 py-1.5 text-center font-semibold ${tint.text}`}
                        style={{ writingMode: 'vertical-rl' }}
                      >
                        {cat.shortName} · {total}h
                      </td>
                    )}
                    <td className="border border-gray-200 px-2 py-1.5 text-gray-500">{act.id}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-gray-800">{act.name}</td>
                    <td className="border border-gray-200 px-2 py-1.5 text-right font-medium text-gray-800">{act.maxHours}h</td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 flex-shrink-0">
          Mesmos limites usados na validação de certificados do sistema.
        </div>
      </div>
    </div>
  )
}
