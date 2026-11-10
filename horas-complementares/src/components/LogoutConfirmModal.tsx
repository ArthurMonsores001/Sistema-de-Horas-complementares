'use client'

import { LogOut, ShieldCheck, X } from 'lucide-react'

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
  if (!open) return null

  const isSupervisor = context === 'supervisor'

  return (
    <div className="fixed inset-0 backdrop-blur-sm z-[70] flex items-center justify-center px-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.28)]">
        <div
          className="relative px-6 pb-6 pt-5 text-white"
          style={{
            background: isSupervisor
              ? 'linear-gradient(135deg, #0f3d2e 0%, #166534 55%, #15803d 100%)'
              : 'linear-gradient(135deg, #2b0a11 0%, #7f1d2d 58%, #9f1239 100%)',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_65%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/20">
                {isSupervisor ? <ShieldCheck size={22} /> : <LogOut size={22} />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  Confirmação
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Encerrar sessão?
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-colors hover:bg-white/16 hover:text-white"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          <p className="relative mt-5 max-w-sm text-sm leading-6 text-white/78">
            {isSupervisor
              ? 'Você vai sair da área de avaliação e precisará autenticar novamente para revisar certificados.'
              : 'Você vai sair da conta atual e precisará entrar novamente para acessar seus certificados e sincronização.'}
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Conta ativa
            </div>
            <div className="mt-1 break-all text-sm font-semibold text-slate-800">
              {email || 'Conta atual'}
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Permanecer
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={[
                'flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-all',
                isSupervisor
                  ? 'bg-green-600 shadow-lg shadow-green-900/15 hover:bg-green-700'
                  : 'bg-vinho-600 shadow-lg shadow-vinho-900/15 hover:bg-vinho-700',
              ].join(' ')}
            >
              Sair agora
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
