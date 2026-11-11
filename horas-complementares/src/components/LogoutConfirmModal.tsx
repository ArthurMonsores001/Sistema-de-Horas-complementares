'use client'

import { useEffect } from 'react'
import { LogOut } from 'lucide-react'

interface LogoutConfirmModalProps {
  email?: string
  context?: 'student' | 'supervisor'
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function LogoutConfirmModal({
  email,
  context = 'student',
  open,
  onClose,
  onConfirm,
}: LogoutConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const isSupervisor = context === 'supervisor'

  return (
    // No celular vira folha inferior, ao alcance do polegar; no desktop fica centralizado
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-vinho-950/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-description"
        className="view-enter relative w-full bg-white px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl rounded-t-2xl sm:max-w-sm sm:rounded-2xl sm:pb-6"
      >
        <div className={[
          'flex h-10 w-10 items-center justify-center rounded-full',
          isSupervisor ? 'bg-green-50 text-green-700' : 'bg-vinho-50 text-vinho-600',
        ].join(' ')}>
          <LogOut size={18} />
        </div>

        <h2 id="logout-title" className="mt-4 text-lg font-semibold tracking-tight text-gray-900">
          Sair da conta?
        </h2>
        <p id="logout-description" className="mt-1.5 text-sm leading-6 text-gray-500">
          {isSupervisor
            ? 'Para voltar a avaliar certificados você vai precisar entrar de novo.'
            : 'Seus certificados continuam salvos. Para vê-los você vai precisar entrar de novo.'}
        </p>

        {email && (
          <p className="mt-4 break-all border-l-2 border-gray-200 pl-3 text-sm text-gray-700">
            {email}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="min-h-11 rounded-lg px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
          >
            Continuar aqui
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'min-h-11 rounded-lg px-5 text-sm font-semibold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              isSupervisor
                ? 'bg-green-700 hover:bg-green-800 focus-visible:outline-green-700'
                : 'bg-vinho-600 hover:bg-vinho-700 focus-visible:outline-vinho-600',
            ].join(' ')}
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
