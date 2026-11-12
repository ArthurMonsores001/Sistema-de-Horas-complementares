'use client'

import { useState, useEffect } from 'react'
import { StoreType } from '@/hooks/useStore'
import { signIn, signUp, requestPasswordReset, updatePassword } from '@/lib/api'
import { COURSES, ENGINEERING_TYPES } from '@/lib/data'
import { LogIn, UserPlus, ShieldCheck, ArrowLeft, Mail, KeyRound } from 'lucide-react'
import { isStrongPassword, missingPasswordRules } from '@/lib/passwordRules'
import PasswordChecklist from './PasswordChecklist'
import PasswordInput from './PasswordInput'


interface AuthGateProps {
  store: StoreType
  children: React.ReactNode
  supervisorArea: React.ReactNode
}

export default function AuthGate({ store, children, supervisorArea }: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [info, setInfo] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [area, setArea] = useState<'student' | 'supervisor'>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registration, setRegistration] = useState('')
  const [course, setCourse] = useState('')
  const [engineeringType, setEngineeringType] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!store.authUser) {
      setInfo('')
      setEmail('')
      setPassword('')
      setName('')
      setRegistration('')
      setCourse('')
      setEngineeringType('')
      setMessage('')
      setMode('login')
    }
  }, [store.authUser])

  useEffect(() => {
    if (store.linkExpired) {
      setMessage('Link expirado ou inválido. Peça um novo em "Esqueci minha senha".')
      store.dismissExpiredLink()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.linkExpired])

  const switchArea = (next: 'student' | 'supervisor') => {
    setArea(next)
    setMode('login')
    setMessage('')
    setInfo('')
    setEmail('')
    setPassword('')
  }

  const goTo = (next: 'login' | 'register' | 'forgot') => {
    if (mode === 'register' || next === 'register') {
      setEmail('')
      setName('')
      setRegistration('')
      setCourse('')
      setEngineeringType('')
    }
    setPassword('')
    setMode(next)
    setMessage('')
    setInfo('')
  }

  const saveNewPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!isStrongPassword(newPassword)) {
      setMessage(`A senha ainda não cumpre os requisitos. Falta: ${missingPasswordRules(newPassword).join(', ')}.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('As senhas não conferem.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      store.finishRecovery()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a senha.')
    } finally {
      setLoading(false)
    }
  }

  const cancelRecovery = async () => {
    setNewPassword('')
    setConfirmPassword('')
    setMessage('')
    await store.logout()
    store.finishRecovery()
  }

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setInfo('')

    if (mode === 'forgot') {
      try {
        await requestPasswordReset(email.trim())
        setInfo('Se o e-mail estiver cadastrado, você receberá o link para redefinir a senha. Confira também o spam.')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.')
      } finally {
        setLoading(false)
      }
      return
    }

    let signUpSucceeded = false
    try {
      if (mode === 'register' && (!name.trim() || !registration.trim() || !course.trim())) {
        setMessage('Informe nome, matrícula e curso para criar a conta.')
        return
      }
      if (mode === 'register' && course === 'Engenharia' && !engineeringType) {
        setMessage('Selecione o tipo de engenharia.')
        return
      }

      if (mode === 'register' && !isStrongPassword(password)) {
        setMessage(`A senha ainda não cumpre os requisitos. Falta: ${missingPasswordRules(password).join(', ')}.`)
        return
      }

      let user
      if (mode === 'login') {
        user = await signIn(email, password)
      } else {
        const created = await signUp(email, password, {
          name: name.trim(),
          registration: registration.trim(),
          course: course.trim(),
          engineeringType: course === 'Engenharia' ? engineeringType : undefined,
        })
        // Confirmacao de e-mail ligada: ainda nao ha sessao. Os dados ficam na conta
        // e viram perfil no primeiro login.
        if (created.needsConfirmation) {
          goTo('login')
          setInfo('Conta criada. Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre. Confira também o spam.')
          return
        }
        user = created.user
        signUpSucceeded = true
      }
      // O perfil informado no cadastro e gravado dentro de onAuthSuccess
      const role = await store.onAuthSuccess(user)

      // Dados nao carregaram: o app mostra a tela de erro com "Tentar de novo"
      if (role === null && mode === 'login') return

      if (area === 'supervisor' && role !== 'supervisor') {
        await store.logout()
        setMessage('Esta conta não tem permissão de supervisor.')
        return
      }

    } catch (error) {
      if (signUpSucceeded) await store.logout()
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

  if (store.authUser && store.recovering) {
    return (
      <AuthShell tone="student" title="Criar nova senha" subtitle="Escolha uma nova senha para acessar sua conta.">
            <form onSubmit={saveNewPassword} className="space-y-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Nova senha</span>
                <PasswordInput
                  required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Crie uma senha forte"
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                />
                <PasswordChecklist password={newPassword} />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar nova senha</span>
                <PasswordInput
                  required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                />
              </label>
              {message && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 text-sm font-medium">{message}</div>
              )}
              <button
                type="submit" disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 bg-vinho-600 hover:bg-vinho-700"
              >
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <KeyRound size={16} />}
                Salvar nova senha
              </button>
              <button type="button" onClick={cancelRecovery} className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium">
                Cancelar
              </button>
            </form>
      </AuthShell>
    )
  }

  if (store.authUser) {
    return store.userRole === 'supervisor' ? <>{supervisorArea}</> : <>{children}</>
  }

  const isSupervisor = area === 'supervisor'

  return (
    <AuthShell
      tone={isSupervisor ? 'supervisor' : 'student'}
      title={mode === 'forgot' ? 'Redefinir senha' : isSupervisor ? 'Entrar como supervisor' : mode === 'login' ? 'Entrar' : 'Criar conta'}
      subtitle={mode === 'forgot'
        ? 'Informe seu e-mail para receber o link de redefinição.'
        : isSupervisor
          ? 'Acesso restrito a quem avalia certificados.'
          : mode === 'login'
            ? 'Use o e-mail e a senha da sua conta.'
            : 'Leva um minuto. Depois é só enviar seus certificados.'}
      onBack={isSupervisor ? () => switchArea('student') : undefined}
    >
            {/* Entrar / Criar conta - somente área do aluno */}
            {!isSupervisor && mode !== 'forgot' && (
              <div className="flex gap-6 border-b border-gray-200 mb-6">
                {(['login', 'register'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => goTo(tab)}
                    aria-current={mode === tab ? 'page' : undefined}
                    className={['-mb-px pb-2.5 border-b-2 text-sm font-semibold transition-colors',
                      mode === tab ? 'border-vinho-600 text-vinho-700' : 'border-transparent text-gray-500 hover:text-gray-700'].join(' ')}
                  >
                    {tab === 'login' ? 'Entrar' : 'Criar conta'}
                  </button>
                ))}
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
                        placeholder="Ex: 202400000"
                        className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">Curso</span>
                      <select
                        required value={course}
                        onChange={e => { setCourse(e.target.value); setEngineeringType('') }}
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
                  {course === 'Engenharia' && (
                    <label className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Engenharia</span>
                      <select
                        required value={engineeringType} onChange={e => setEngineeringType(e.target.value)}
                        className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none bg-white"
                      >
                        <option value="" disabled>Selecione o tipo...</option>
                        {ENGINEERING_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  )}
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

              {mode !== 'forgot' && (
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Senha</span>
                  <PasswordInput
                    key={mode} required value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Crie uma senha forte' : 'Sua senha'}
                    className="w-full min-h-11 px-3.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:border-vinho-400 focus:ring-2 focus:ring-vinho-100 outline-none"
                  />
                  {mode === 'register' && <PasswordChecklist password={password} />}
                  {mode === 'login' && (
                    <button
                      type="button" onClick={() => goTo('forgot')}
                      className={['mt-2 text-xs font-semibold hover:underline', isSupervisor ? 'text-green-700' : 'text-vinho-600'].join(' ')}
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </label>
              )}

              {message && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 text-sm font-medium">
                  {message}
                </div>
              )}
              {info && (
                <div className="rounded-lg bg-green-50 border border-green-100 text-green-700 px-4 py-3 text-sm font-medium">
                  {info}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className={['w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60',
                  isSupervisor ? 'bg-green-600 hover:bg-green-700' : 'bg-vinho-600 hover:bg-vinho-700'].join(' ')}
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : mode === 'forgot' ? <Mail size={16} /> : isSupervisor ? <ShieldCheck size={16} /> : mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                {mode === 'forgot' ? 'Enviar link de redefinição' : isSupervisor ? 'Entrar como Supervisor' : mode === 'login' ? 'Entrar' : 'Criar conta e entrar'}
              </button>
              {mode === 'forgot' && (
                <button type="button" onClick={() => goTo('login')} className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium">
                  Voltar ao login
                </button>
              )}
            </form>

            {/* Link para área do supervisor — somente visível na tela do aluno */}
            {!isSupervisor && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => switchArea('supervisor')}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 font-medium transition-colors"
                >
                  <ShieldCheck size={15} />
                  Sou supervisor
                </button>
              </div>
            )}
    </AuthShell>
  )
}

// Passos reais do uso pelo aluno, na ordem em que acontecem
const STEPS = [
  'Envie o certificado em PDF ou imagem.',
  'O sistema sugere a categoria e as horas.',
  'Acompanhe quanto falta para concluir.',
]

function AuthShell({
  tone,
  title,
  subtitle,
  onBack,
  children,
}: {
  tone: 'student' | 'supervisor'
  title: string
  subtitle: string
  onBack?: () => void
  children: React.ReactNode
}) {
  const isSupervisor = tone === 'supervisor'

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[5fr_7fr]">
      {/* Painel da instituicao: faixa no celular, coluna inteira no desktop */}
      <aside className={[
        // Fixo na altura da tela: formulario longo rola sozinho e o texto nao some
        'flex flex-col px-6 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:px-12 lg:py-12',
        isSupervisor ? 'bg-green-900' : 'bg-vinho-600',
      ].join(' ')}>
        <p className="text-sm font-medium text-white/70">Universidade de Vassouras</p>

        <div className="mt-3 lg:my-auto">
          <p className="text-2xl font-semibold leading-[1.05] tracking-tight lg:text-5xl">
            {isSupervisor ? <>Avaliação de<br />certificados</> : <>Horas<br className="hidden lg:block" /> complementares</>}
          </p>

          {isSupervisor ? (
            <p className="mt-6 hidden max-w-xs text-sm leading-6 text-white/75 lg:block">
              Confira os certificados enviados pelos alunos, aprove ou devolva com um comentário.
            </p>
          ) : (
            <ol className="mt-8 hidden space-y-3 lg:block">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-baseline gap-3 text-sm leading-6 text-white/85">
                  <span className="w-4 flex-shrink-0 font-semibold tabular-nums text-white/50">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10 lg:py-12">
        <div className="w-full max-w-sm">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
            >
              <ArrowLeft size={15} />
              Voltar para área do aluno
            </button>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1.5 mb-7 text-sm leading-6 text-gray-500">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
