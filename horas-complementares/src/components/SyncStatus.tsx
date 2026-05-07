'use client'

import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import { StoreType } from '@/hooks/useStore'

interface SyncStatusProps {
  store: StoreType
}

export default function SyncStatus({ store }: SyncStatusProps) {
  if (!store.authUser) {
    return (
      <div className="border-b border-amber-100 bg-amber-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-amber-700">
          <WifiOff size={15} className="flex-shrink-0" />
          <span className="font-medium">Modo local:</span>
          <span>entre na conta para salvar no Supabase.</span>
        </div>
      </div>
    )
  }

  if (store.apiStatus === 'syncing') {
    return (
      <div className="border-b border-indigo-100 bg-indigo-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-indigo-700">
          <Loader2 size={15} className="animate-spin flex-shrink-0" />
          <span className="font-medium">Sincronizando com o Supabase...</span>
        </div>
      </div>
    )
  }

  if (store.apiStatus === 'error') {
    return (
      <div className="border-b border-red-100 bg-red-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold">Não foi salvo online.</span>
            <span className="ml-1">{store.apiError || 'Verifique sua conexão ou as policies do Supabase.'}</span>
          </div>
        </div>
      </div>
    )
  }

  if (store.apiStatus === 'online') {
    return (
      <div className="border-b border-emerald-100 bg-emerald-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          <span className="font-medium">Sincronizado no Supabase.</span>
        </div>
      </div>
    )
  }

  return null
}
