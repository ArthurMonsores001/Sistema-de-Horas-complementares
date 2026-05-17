'use client'

import { useState } from 'react'
import { StoreType } from '@/hooks/useStore'
import { signIn, signUp } from '@/lib/api'
import { COURSES } from '@/lib/data'
import { LockKeyhole, LogIn, UserPlus, ShieldCheck, ArrowLeft } from 'lucide-react'

interface AuthGateProps {
  store: StoreType
  children: React.ReactNode
  supervisorArea: React.ReactNode
}

export default function AuthGate({ store, children, supervisorArea }: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [area, setArea] = useState<'student' | 'supervisor'>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registration, setRegistration] = useState('')
  const [course, setCourse] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const switchArea = (next: 'student' | 'supervisor') => {
    setArea(next)
    setMode('login')
    setMessage('')
    setEmail('')
    setPassword('')
  }

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (mode === 'register' && (!name.trim() || !registration.trim() || !course.trim())) {
        setMessage('Informe nome, matrícula e curso para criar a conta.')
        return
      }

      const user = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
      const role = await store.onAuthSuccess(user)

      if (area === 'supervisor' && role !== 'supervisor') {
        await store.logout()
        setMessage('Esta conta não tem permissão de supervisor.')
        return
      }

      if (mode === 'register' && role === 'student') {
        const saved = await store.saveProfile({
          name: name.trim(),
          registration: registration.trim(),
          cpf: '',
          course: course.trim(),
          turma: '',
          periodo: '',
          totalRequired: 120,
        }, user)

        if (!saved) {
          throw new Error('A conta foi criada, mas o perfil não foi salvo. Verifique as políticas RLS da tabela student_profiles.')
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  if (store.authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f8]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-vinho-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Validando sessão...</span>
        </div>
      </div>
    )
  }

  if (store.authUser) {
    return store.userRole === 'supervisor' ? <>{supervisorArea}</> : <>{children}</>
  }

  const isSupervisor = area === 'supervisor'

  return (
    <div className="min-h-screen bg-[#f0f2f8] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-vinho-900/10 border border-gray-100 overflow-hidden">

          {/* ── Header ── */}
          <div
            className="px-6 py-7 text-white"
            style={{
              background: isSupervisor
                ? 'linear-gradient(135deg, #14532d 0%, #15803d 55%, #16a34a 100%)'
                : 'linear-gradient(135deg, #26040a 0%, #790E18 55%, #5e0b13 100%)',
            }}
          >
            {isSupervisor && (
              <button
                type="button"
                onClick={() => switchArea('student')}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium mb-4 transition-colors"
              >
                <ArrowLeft size={13} />
                Voltar para área do aluno
              </button>
            )}
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-4">
              {isSupervisor ? <ShieldCheck size={22} /> : <LockKeyhole size={22} />}
            </div>
            <h1 className="text-xl font-bold">
              {isSupervisor ? 'Área do Supervisor' : mode === 'login' ? 'Faça Login' : 'Criar conta'}
            </h1>
            <p className="text-sm mt-1 opacity-80">
              {isSupervisor
                ? 'Acesso restrito para avaliação de certificados.'
                : mode === 'login'
                  ? 'Registre seus certificados e confira suas horas complementares.'
                  : 'Crie sua conta para começar a registrar horas.'}
            </p>
          </div>

          {/* ── Body ── */}
          <div className="px-6 pt-5 pb-6">

            {/* Entrar / Criar conta tabs — somente área do aluno */}
            {!isSupervisor && (
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setMessage('') }}
                  className={['flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-colors',
                    mode === 'login' ? 'bg-white text-vinho-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
                >
                  <LogIn size={14} />
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setMessage('') }}
                  className={['flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-colors',
                    mode === 'register' ? 'bg-white text-vinho-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
                >
                  <UserPlus size={14} />
                  Criar conta
                </button>
              </div>
            )}

            <form onSubmit={authenticate} className="space-y-4">
              {/* Campos de cadastro */}
              {!isSupervisor && mode === 'register' && (
                <>
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</span>
                    <input
                      required type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">Matrícula</span>
                      <input
                        required type="text" value={registration} onChange={e => setRegistration(e.target.value)}
                        placeholder="Ex: 20240001"
                        className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">Curso</span>
                      <select
                        required value={course} onChange={e => setCourse(e.target.value)}
                        className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none bg-white"
                      >
                        <option value="" disabled>Selecione...</option>
                        {COURSES.map(c => (
                          <option key={c.id} value={c.id} disabled={!c.available}>
                            {c.name}{!c.available ? ' (em breve)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Email</span>
                <input
                  required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Senha</span>
                <input
                  required type="password" value={password} onChange={e => setPassword(e.target.value)}
                  minLength={6} placeholder="mínimo 6 caracteres"
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                />
              </label>

              {message && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 text-sm font-medium">
                  {message}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className={['w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60',
                  isSupervisor ? 'bg-green-600 hover:bg-green-700' : 'bg-vinho-600 hover:bg-vinho-700'].join(' ')}
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : isSupervisor ? <ShieldCheck size={16} /> : mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                {isSupervisor ? 'Entrar como Supervisor' : mode === 'login' ? 'Entrar' : 'Criar conta e entrar'}
              </button>
            </form>

            {/* Link para área do supervisor — somente visível na tela do aluno */}
            {!isSupervisor && (
              <div className="mt-5 pt-4 border-t border-gray-100 flex justify-center">
                <button
                  type="button"
                  onClick={() => switchArea('supervisor')}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-700 font-medium transition-colors"
                >
                  <ShieldCheck size={13} />
                  Acessar área do supervisor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
