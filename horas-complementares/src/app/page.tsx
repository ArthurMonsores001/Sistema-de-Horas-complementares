'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/hooks/useStore'
import { TabId } from '@/lib/types'
import Navbar from '@/components/Navbar'
import Dashboard from '@/components/Dashboard'
import AddCertificate from '@/components/AddCertificate'
import Certificates from '@/components/Certificates'
import Settings from '@/components/Settings'
import AuthGate from '@/components/AuthGate'
import CategoryDetails from '@/components/CategoryDetails'
import SyncStatus from '@/components/SyncStatus'
import SupervisorArea from '@/components/SupervisorArea'
import EvaluationNotification from '@/components/EvaluationNotification'
import Footer from '@/components/Footer'
import LogoutConfirmModal from '@/components/LogoutConfirmModal'

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [selectedCategoryId, setSelectedCategoryId] = useState(0)
  const store = useStore()

  useEffect(() => {
    setTab('dashboard')
  }, [store.authUser])

  const [showLogout, setShowLogout] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    setRetrying(true)
    await store.retryLoad()
    setRetrying(false)
  }

  const openCategory =(categoryId: number) => {
    setSelectedCategoryId(categoryId)
    setTab('category')
  }

  if (!store.hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-vinho-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <AuthGate store={store} supervisorArea={<SupervisorArea store={store} />}>
      {store.loadFailed ? (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8] px-4">
          <div role="alert" className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl shadow-vinho-900/10 p-6 text-center">
            <h1 className="text-lg font-bold text-slate-800">Não foi possível carregar seus dados</h1>
            <p className="text-sm text-slate-500 mt-2">
              Seus dados continuam salvos. Verifique a conexão e tente de novo.
            </p>
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="mt-5 w-full rounded-lg bg-vinho-500 hover:bg-vinho-600 text-white text-sm font-semibold py-2.5 disabled:opacity-60"
            >
              {retrying ? 'Carregando...' : 'Tentar de novo'}
            </button>
            <button
              type="button"
              onClick={store.logout}
              className="mt-2 w-full rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 py-2"
            >
              Sair
            </button>
          </div>
        </div>
      ) : (
      <div className="min-h-screen flex flex-col sm:flex-row bg-[#f0f2f8]">
        {store.authUser && store.userRole === 'student' && (
          <EvaluationNotification
            certificates={store.state.certificates}
            userId={store.authUser.id}
          />
        )}
        <Navbar
          activeTab={tab}
          onTabChange={setTab}
          displayName={store.state.student.name || store.authUser?.email}
          onLogout={() => setShowLogout(true)}
        />
        <LogoutConfirmModal
          open={showLogout}
          email={store.authUser?.email}
          context="student"
          onClose={() => setShowLogout(false)}
          onConfirm={() => {
            setShowLogout(false)
            store.logout()
          }}
        />
        <div className="flex-1 min-w-0 flex flex-col">
        <SyncStatus store={store} />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="view-enter">
            {tab === 'dashboard'    && <Dashboard     store={store} onNavigate={setTab} onCategorySelect={openCategory} />}
            {tab === 'add'          && <AddCertificate store={store} onSuccess={() => setTab('certificates')} />}
            {tab === 'certificates' && <Certificates  store={store} />}
            {tab === 'settings'     && <Settings      store={store} />}
            {tab === 'category'     && <CategoryDetails categoryId={selectedCategoryId} store={store} onNavigate={setTab} />}
          </div>
        </main>
        <Footer />
        </div>
      </div>
      )}
    </AuthGate>
  )
}
