'use client'

import { useEffect, useRef, useState } from 'react'
import { StoreType } from '@/hooks/useStore'
import { Student } from '@/lib/types'
import { exportStudentExcelReport } from '@/lib/excelReport'
import { Download, FileSpreadsheet, LogOut, RotateCcw, Save, Trash2, Upload, Users, RefreshCw, Cloud } from 'lucide-react'

interface SettingsProps {
  store: StoreType
}

export default function Settings({ store }: SettingsProps) {
  const [student, setStudent] = useState<Student>(store.state.student)
  const [profileToLoad, setProfileToLoad] = useState(store.activeRegistration)
  const [message, setMessage] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const savedProfiles = store.getSavedProfiles()

  useEffect(() => {
    setStudent(store.state.student)
    setProfileToLoad(store.activeRegistration)
  }, [store.activeRegistration, store.state.student])

  const updateField = (field: keyof Student, value: string) => {
    setStudent(prev => ({
      ...prev,
      [field]: field === 'totalRequired' ? Math.max(1, Number(value) || 1) : value,
    }))
  }

  const pullRemote = async () => {
    const ok = await store.pullFromBackend()
    setMessage(ok
      ? { type: 'ok', text: 'Dados carregados do Supabase.' }
      : { type: 'warn', text: store.apiError || 'Não foi possível carregar os dados.' }
    )
  }

  const pushRemote = async () => {
    const ok = await store.syncToBackend()
    setMessage(ok
      ? { type: 'ok', text: 'Perfil sincronizado com o Supabase.' }
      : { type: 'warn', text: store.apiError || 'Não foi possível sincronizar.' }
    )
  }

  const saveStudent = async () => {
    const saved = await store.saveProfile(student)
    setMessage(saved
      ? { type: 'ok', text: `Perfil salvo para a matrícula ${student.registration.trim()}.` }
      : { type: 'warn', text: 'Informe uma matrícula para salvar um perfil único.' }
    )
  }

  const loadSelectedProfile = () => {
    if (!profileToLoad) {
      setMessage({ type: 'warn', text: 'Selecione uma matrícula salva para carregar.' })
      return
    }
    const loaded = store.loadProfile(profileToLoad)
    setMessage(loaded
      ? { type: 'ok', text: 'Perfil carregado com sucesso.' }
      : { type: 'warn', text: 'Não encontrei essa matrícula salva.' }
    )
  }

  const deleteSelectedProfile = async () => {
    if (!profileToLoad) {
      setMessage({ type: 'warn', text: 'Selecione uma matrícula salva para excluir.' })
      return
    }
    const profile = savedProfiles.find(p => p.registration === profileToLoad)
    if (!window.confirm(`Excluir o perfil "${profile?.student.name || profileToLoad}" e seus certificados?`)) return
    const deleted = await store.deleteProfile(profileToLoad)
    setMessage(deleted
      ? { type: 'ok', text: 'Perfil excluído.' }
      : { type: 'warn', text: 'Não foi possível excluir esse perfil.' }
    )
  }

  const exportData = () => {
    const payload = {
      ...store.exportAllProfiles(),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `horas-complementares-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage({ type: 'ok', text: 'Backup exportado em JSON.' })
  }

  const exportExcel = () => {
    if (!store.state.student.registration && store.state.certificates.length === 0) {
      setMessage({ type: 'warn', text: 'Preencha o perfil ou adicione certificados antes de gerar o relatório.' })
      return
    }
    exportStudentExcelReport(store.state)
    setMessage({ type: 'ok', text: 'Relatório Excel gerado com sucesso.' })
  }

  const importData = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || (!parsed.profiles && (!Array.isArray(parsed.certificates) || !parsed.student))) {
        throw new Error('Arquivo inválido')
      }
      store.importData(parsed)
      setMessage({ type: 'ok', text: 'Backup importado com sucesso.' })
    } catch {
      setMessage({ type: 'warn', text: 'Não foi possível importar. Verifique se o arquivo é um backup válido.' })
    }
  }

  const clearCertificates = () => {
    if (window.confirm('Remover todos os dados locais? Os dados no Supabase serão mantidos.')) {
      store.clearAll()
      setMessage({ type: 'ok', text: 'Dados locais removidos.' })
    }
  }

  const handleLogout = async () => {
    if (window.confirm('Sair da conta?')) {
      await store.logout()
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Dados do estudante, backup e restauração.</p>
      </div>

      {message && (
        <div className={['rounded-lg px-4 py-3 text-sm font-medium',
          message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'].join(' ')}>
          {message.text}
        </div>
      )}

      {/* ── Conta Supabase ──────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cloud size={15} className="text-indigo-500" />
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Conta</div>
        </div>

        {store.authUser ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">{store.authUser.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Status: <span className={store.apiStatus === 'online' ? 'text-emerald-600' : store.apiStatus === 'syncing' ? 'text-amber-600' : 'text-red-500'}>
                  {store.apiStatus === 'online' ? 'Conectado' : store.apiStatus === 'syncing' ? 'Sincronizando…' : store.apiStatus === 'error' ? 'Erro' : 'Local'}
                </span>
              </p>
              {store.apiError && <p className="text-xs text-red-500 mt-1">{store.apiError}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={pullRemote}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                <Download size={14} /> Baixar
              </button>
              <button onClick={pushRemote}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
                <RefreshCw size={14} /> Sincronizar
              </button>
              <button onClick={handleLogout}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Não conectado. Faça login para sincronizar seus dados.</p>
        )}
      </section>

      {/* ── Perfis por Matrícula ────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-5">
          <Users size={15} className="text-indigo-500" />
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Perfis por Matrícula</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 mb-5">
          <select value={profileToLoad} onChange={e => setProfileToLoad(e.target.value)}
            className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
            <option value="">Selecione uma matrícula salva...</option>
            {savedProfiles.map(p => (
              <option key={p.registration} value={p.registration}>
                {p.student.registration} · {p.student.name || 'Sem nome'} · {p.certificates.length} certificados
              </option>
            ))}
          </select>
          <button onClick={loadSelectedProfile}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Carregar
          </button>
          <button onClick={deleteSelectedProfile}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-red-100 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
            <Trash2 size={14} /> Excluir
          </button>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Perfil Acadêmico</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['name', 'registration', 'cpf', 'rg', 'course'] as const).map(field => (
            <label key={field} className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5 capitalize">
                {field === 'name' ? 'Nome' : field === 'registration' ? 'Matrícula' : field === 'cpf' ? 'CPF' : field === 'rg' ? 'RG' : 'Curso'}
              </span>
              <input value={student[field]} onChange={e => updateField(field, e.target.value)}
                className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
          ))}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Total necessário (horas)</span>
            <input type="number" min="1" value={student.totalRequired} onChange={e => updateField('totalRequired', e.target.value)}
              className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </label>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={saveStudent}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            <Save size={15} /> Salvar perfil por matrícula
          </button>
        </div>
      </section>

      {/* ── Backup ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5">Backup Local</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <button onClick={exportExcel}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            <FileSpreadsheet size={15} /> Exportar Excel
          </button>
          <button onClick={exportData}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Download size={15} /> Exportar JSON
          </button>
          <button onClick={() => importRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
            <Upload size={15} /> Importar JSON
          </button>
          <button onClick={clearCertificates}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-red-100 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
            <RotateCcw size={15} /> Limpar local
          </button>
        </div>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = '' }} />
      </section>
    </div>
  )
}
