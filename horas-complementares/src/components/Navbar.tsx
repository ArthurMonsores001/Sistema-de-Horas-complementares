'use client'

import { useEffect, useState } from 'react'
import { TabId } from '@/lib/types'
import { LayoutDashboard, PlusCircle, FileText, Settings, GraduationCap, PanelLeftClose, PanelLeftOpen, Menu, X, LogOut } from 'lucide-react'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',    label: 'Dashboard',     Icon: LayoutDashboard },
  { id: 'add',          label: 'Adicionar',     Icon: PlusCircle },
  { id: 'certificates', label: 'Certificados',  Icon: FileText },
  { id: 'settings',     label: 'Configurações', Icon: Settings },
]

const OPEN_KEY = 'hc-menu-open'

interface NavbarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  displayName?: string
  onLogout: () => void
}

// Menu lateral nos dois tamanhos.
// Desktop (sm+): fixo na esquerda, abre e recolhe para so icones.
// Celular: gaveta que desliza por cima do conteudo, aberta pelo botao do cabecalho.
export default function Navbar({ activeTab, onTabChange, displayName, onLogout }: NavbarProps) {
  const firstName = displayName?.trim().split(' ')[0]
  const title = firstName ? `Olá, ${firstName}` : 'Horas Complementares'
  const [open, setOpen] = useState(true)       // desktop: expandido ou recolhido
  const [drawer, setDrawer] = useState(false)  // celular: gaveta aberta

  useEffect(() => {
    try { if (localStorage.getItem(OPEN_KEY) === '0') setOpen(false) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  const toggle = () => {
    setOpen(prev => {
      try { localStorage.setItem(OPEN_KEY, prev ? '0' : '1') } catch { /* ignore */ }
      return !prev
    })
  }

  // No celular o rotulo sempre aparece; no desktop some quando recolhido
  const label = open ? '' : 'sm:hidden'
  const item = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap'
  const idle = 'text-white/60 hover:text-white hover:bg-white/10'

  return (
    <>
      {/* Cabecalho do celular */}
      <header className="sm:hidden sticky top-0 z-30 bg-vinho-600 h-12 px-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Abrir menu"
          aria-expanded={drawer}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
        <span className="text-white font-semibold text-sm truncate">{title}</span>
      </header>

      {/* Fundo escuro atras da gaveta */}
      {drawer && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawer(false)}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Menu principal"
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 max-w-[80vw] bg-vinho-600 transition-[transform,visibility,width] duration-200',
          drawer ? 'translate-x-0' : '-translate-x-full invisible',
          'sm:sticky sm:top-0 sm:bottom-auto sm:h-screen sm:max-w-none sm:translate-x-0 sm:visible sm:flex-shrink-0',
          open ? 'sm:w-56' : 'sm:w-16',
        ].join(' ')}
      >
        <div className="flex flex-col h-full gap-1 px-2 py-3">
          {/* Logo, nome e botao de recolher. Recolhido no desktop: sobra so o botao */}
          <div className={`flex items-center gap-2.5 px-2 pb-3 mb-2 border-b border-white/10 ${open ? '' : 'sm:justify-center sm:px-0'}`}>
            <div className={`w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 ${label}`}>
              <GraduationCap size={17} className="text-white" />
            </div>
            <div className={`${label} min-w-0 flex-1`}>
              <span className="block text-white font-semibold text-sm leading-tight truncate">{title}</span>
              {firstName && (
                <span className="block text-white/50 text-[11px] leading-tight truncate">Horas Complementares</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Fechar menu"
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10"
            >
              <X size={18} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={open ? 'Recolher menu' : 'Abrir menu'}
              title={open ? 'Recolher menu' : 'Abrir menu'}
              className="hidden sm:flex w-9 h-9 flex-shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-150"
            >
              {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          </div>

          {TABS.map(({ id, label: text, Icon }) => (
            <button
              key={id}
              onClick={() => { onTabChange(id); setDrawer(false) }}
              aria-label={text}
              title={open ? undefined : text}
              aria-current={activeTab === id ? 'page' : undefined}
              className={[
                item,
                // Configuracoes desce para o rodape, junto de Sair
                id === 'settings' ? 'mt-auto' : '',
                open ? '' : 'sm:justify-center',
                activeTab === id ? 'bg-white/15 text-white' : idle,
              ].join(' ')}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className={label}>{text}</span>
            </button>
          ))}

          {/* Sair: pede confirmacao no modal */}
          <button
            type="button"
            onClick={() => { setDrawer(false); onLogout() }}
            aria-label="Sair da conta"
            title={open ? undefined : 'Sair da conta'}
            className={[item, idle, open ? '' : 'sm:justify-center'].join(' ')}
          >
            <LogOut size={17} className="flex-shrink-0" />
            <span className={label}>Sair</span>
          </button>
        </div>
      </nav>
    </>
  )
}
