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

export default function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [selectedCategoryId, setSelectedCategoryId] = useState(0)
  const store = useStore()

  useEffect(() => {
    setTab('dashboard')
  }, [store.authUser])

  const openCategory = (categoryId: number) => {
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
      <div className="min-h-screen flex flex-col bg-[#f0f2f8]">
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
        />
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
    </AuthGate>
  )
}
