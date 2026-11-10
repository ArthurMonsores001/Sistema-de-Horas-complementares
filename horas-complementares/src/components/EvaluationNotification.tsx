'use client'

import { useState, useEffect } from 'react'
import { Certificate } from '@/lib/types'
import { ACTIVITIES } from '@/lib/data'
import { CheckCircle2, XCircle, Bell, X, MessageSquare } from 'lucide-react'

interface EvaluationNotificationProps {
  certificates: Certificate[]
  userId: string
}

const STORAGE_KEY_PREFIX = 'hc-seen-evals-'

function getSeenMap(userId: string): Record<number, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveSeenMap(userId: string, map: Record<number, string>) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(map))
  } catch { /* quota */ }
}

export default function EvaluationNotification({ certificates, userId }: EvaluationNotificationProps) {
  const [newEvals, setNewEvals] = useState<Certificate[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!userId || certificates.length === 0) return

    const seen = getSeenMap(userId)
    const fresh = certificates.filter(c =>
      (c.status === 'approved' || c.status === 'rejected') &&
      seen[c.id] !== c.status,
    )

    if (fresh.length > 0) {
      setNewEvals(fresh)
      setVisible(true)
    }
  }, [certificates, userId])

  const handleClose = () => {
    const seen = getSeenMap(userId)
    for (const c of newEvals) seen[c.id] = c.status!
    saveSeenMap(userId, seen)
    setVisible(false)
  }

  if (!visible || newEvals.length === 0) return null

  const approved = newEvals.filter(c => c.status === 'approved')
  const rejected = newEvals.filter(c => c.status === 'rejected')

  const activityName = (actId: number) =>
    ACTIVITIES.find(a => a.id === actId)?.name ?? `Atividade #${actId}`

  return (
    <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 text-white flex items-start justify-between"
          style={{ background: 'linear-gradient(135deg, #330208 0%, #660510 55%, #53040D 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">Resultado da avaliação</p>
              <p className="text-vinho-200 text-xs mt-0.5">
                {newEvals.length} certificado{newEvals.length > 1 ? 's' : ''} avaliado{newEvals.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/60 hover:text-white transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto space-y-3">
          {/* Approved */}
          {approved.map(cert => (
            <div key={cert.id} className="flex items-start gap-3 bg-green-50 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 leading-snug">
                  {activityName(cert.activityId)}
                </p>
                <p className="text-xs text-green-700 font-medium mt-0.5">Aprovado</p>
                {cert.supervisorComment && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <MessageSquare size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500">{cert.supervisorComment}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Rejected */}
          {rejected.map(cert => (
            <div key={cert.id} className="flex items-start gap-3 bg-red-50 rounded-xl px-3 py-2.5">
              <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 leading-snug">
                  {activityName(cert.activityId)}
                </p>
                <p className="text-xs text-red-600 font-medium mt-0.5">Reprovado</p>
                {cert.supervisorComment && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <MessageSquare size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500">{cert.supervisorComment}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 mb-2.5">
            Certificados reprovados podem ser reenviados após correção.
          </p>
          <button
            onClick={handleClose}
            className="w-full h-10 rounded-xl bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
