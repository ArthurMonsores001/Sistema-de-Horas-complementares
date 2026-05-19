'use client'

import { useEffect, useState } from 'react'
import { StoreType } from '@/hooks/useStore'
import { Student } from '@/lib/types'
import { exportStudentExcelReport } from '@/lib/excelReport'
import { COURSES, ENGINEERING_TYPES } from '@/lib/data'
import { Download, FileSpreadsheet, LogOut, RotateCcw, Save, RefreshCw, Cloud, GraduationCap } from 'lucide-react'
import LogoutConfirmModal from '@/components/LogoutConfirmModal'

interface SettingsProps {
  store: StoreType
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export default function Settings({ store }: SettingsProps) {
  const initialStudent = store.state.student
  const initialCourseValid = COURSES.some(c => c.id === initialStudent.course)
  const [student, setStudent] = useState<Student>(
    initialCourseValid ? initialStudent : { ...initialStudent, course: 'Engenharia', engineeringType: '' }
  )
  const [message, setMessage] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  useEffect(() => {
    const s = store.state.student
    const validCourse = COURSES.some(c => c.id === s.course)
    setStudent(validCourse ? s : { ...s, course: 'Engenharia', engineeringType: '' })
  }, [store.activeRegistration, store.state.student])

  const updateField = (field: keyof Student, value: string) => {
    setStudent(prev => ({
      ...prev,
      [field]: field === 'totalRequired'
        ? Math.max(1, Number(value) || 1)
        : field === 'cpf'
          ? formatCpf(value)
          : value,
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
    if (student.course === 'Engenharia' && !student.engineeringType) {
      setMessage({ type: 'warn', text: 'Selecione o tipo de engenharia antes de salvar.' })
      return
    }
    const saved = await store.saveProfile(student)
    setMessage(saved
      ? { type: 'ok', text: `Perfil salvo para a matrícula ${student.registration.trim()}.` }
      : { type: 'warn', text: 'Informe uma matrícula para salvar um perfil único.' }
    )
  }

  const exportExcel = () => {
    if (!store.state.student.registration && store.state.certificates.length === 0) {
      setMessage({ type: 'warn', text: 'Preencha o perfil ou adicione certificados antes de gerar o relatório.' })
      return
    }
    exportStudentExcelReport(store.state)
    setMessage({ type: 'ok', text: 'Relatório Excel gerado com sucesso.' })
  }

  const clearCertificates = () => {
    if (window.confirm('Remover todos os dados locais? Os dados no Supabase serão mantidos.')) {
      store.clearAll()
      setMessage({ type: 'ok', text: 'Dados locais removidos.' })
    }
  }

  const handleLogout = () => setShowLogoutModal(true)

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

      {/* ── Perfil Acadêmico ────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-5">
          <GraduationCap size={15} className="text-vinho-500" />
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Perfil Acadêmico</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['name', 'registration', 'cpf'] as const).map(field => (
            <label key={field} className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">
                {field === 'name' ? 'Nome' : field === 'registration' ? 'Matrícula' : 'CPF'}
              </span>
              <input
                value={student[field]}
                onChange={e => updateField(field, e.target.value)}
                maxLength={field === 'cpf' ? 14 : undefined}
                className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
              />
            </label>
          ))}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Curso</span>
            <select
              value={student.course}
              onChange={e => {
                const next = e.target.value
                setStudent(prev => ({ ...prev, course: next, engineeringType: next === 'Engenharia' ? prev.engineeringType : '' }))
              }}
              className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 bg-white"
            >
              {COURSES.map(c => (
                <option key={c.id} value={c.id} disabled={!c.available}>
                  {c.name}{!c.available ? ' (em breve)' : ''}
                </option>
              ))}
            </select>
          </label>
          {student.course === 'Engenharia' && (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Engenharia</span>
              <select
                value={student.engineeringType ?? ''}
                onChange={e => setStudent(prev => ({ ...prev, engineeringType: e.target.value }))}
                className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 bg-white"
              >
                <option value="">Selecione o tipo...</option>
                {ENGINEERING_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">Total necessário (horas)</span>
            <input
              type="number"
              min="1"
              value={student.totalRequired}
              onChange={e => updateField('totalRequired', e.target.value)}
              className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100"
            />
          </label>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={saveStudent}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors"
          >
            <Save size={15} /> Salvar perfil
          </button>
        </div>
      </section>

      {/* ── Backup ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5">Backup Local</div>
        <p className="text-xs text-gray-400 mb-3">
          O relatório inclui apenas certificados aprovados pelo supervisor. Guarde-o com cuidado e evite compartilhar por canais não seguros.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={exportExcel}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            <FileSpreadsheet size={15} /> Exportar Excel
          </button>
          <button onClick={clearCertificates}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-red-100 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
            <RotateCcw size={15} /> Limpar local
          </button>
        </div>
      </section>

      {/* ── Conta Supabase ──────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cloud size={15} className="text-vinho-500" />
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
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-lg bg-vinho-600 hover:bg-vinho-700 text-white text-sm font-semibold transition-colors">
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

      <LogoutConfirmModal
        open={showLogoutModal}
        email={store.authUser?.email}
        context="student"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false)
          store.logout()
        }}
      />
    </div>
  )
}
