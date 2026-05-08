'use client'

import { useState } from 'react'
import { StoreType } from '@/hooks/useStore'
import { signIn, signUp } from '@/lib/api'
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react'

interface AuthGateProps {
  store: StoreType
  children: React.ReactNode
}

export default function AuthGate({ store, children }: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registration, setRegistration] = useState('')
  const [course, setCourse] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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

      await store.onAuthSuccess(user)

      if (mode === 'register') {
        const saved = await store.saveProfile({
          name: name.trim(),
          registration: registration.trim(),
          cpf: '',
          course: course.trim(),
          totalRequired: 120,
        }, user)

        if (!saved) {
          throw new Error('A conta foi criada, mas o perfil não foi salvo no Supabase. Verifique as políticas RLS da tabela student_profiles.')
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
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Validando sessão...</span>
        </div>
      </div>
    )
  }

  if (store.authUser) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#f0f2f8] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl shadow-indigo-900/10 border border-gray-100 overflow-hidden">
          <div
            className="px-6 py-6 text-white"
            style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #4338ca 100%)' }}
          >
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-4">
              <LockKeyhole size={22} />
            </div>
            <h1 className="text-xl font-bold">
              {mode === 'login' ? 'Faça Login' : 'Criar conta'}
            </h1>
            <p className="text-sm text-indigo-200 mt-1">
              {mode === 'login'
                ? 'Entre para acessar seu perfil e registrar suas horas complementares.'
                : 'Crie sua conta para começar a acompanhar suas horas complementares.'}
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button type="button" onClick={() => { setMode('login'); setMessage('') }}
                className={['min-h-10 rounded-lg text-sm font-semibold transition-colors',
                  mode === 'login' ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'].join(' ')}>
                Entrar
              </button>
              <button type="button" onClick={() => { setMode('register'); setMessage('') }}
                className={['min-h-10 rounded-lg text-sm font-semibold transition-colors',
                  mode === 'register' ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'].join(' ')}>
                Criar conta
              </button>
            </div>

            <form onSubmit={authenticate} className="space-y-4">
              {mode === 'register' && (
                <>
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</span>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">Matrícula</span>
                      <input
                        required
                        type="text"
                        value={registration}
                        onChange={e => setRegistration(e.target.value)}
                        placeholder="Ex: 20240001"
                        className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">Curso</span>
                      <input
                        required
                        type="text"
                        value={course}
                        onChange={e => setCourse(e.target.value)}
                        placeholder="Ex: Engenharia"
                        className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                    </label>
                  </div>
                </>
              )}

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Email</span>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Senha</span>
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)}
                  minLength={6} placeholder="mínimo 6 caracteres"
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
              </label>

              {message && (
                <div className="rounded-lg bg-amber-50 text-amber-700 px-4 py-3 text-sm font-medium">
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                {mode === 'login' ? 'Entrar no sistema' : 'Criar conta e entrar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
