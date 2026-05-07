'use client'

import { TabId } from '@/lib/types'
import { LayoutDashboard, PlusCircle, FileText, Settings, GraduationCap, Moon, Sun } from 'lucide-react'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',    label: 'Dashboard',     Icon: LayoutDashboard },
  { id: 'add',          label: 'Adicionar',      Icon: PlusCircle },
  { id: 'certificates', label: 'Certificados',   Icon: FileText },
  { id: 'settings',     label: 'Configurações',  Icon: Settings },
]

interface NavbarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  displayName?: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Navbar({ activeTab, onTabChange, displayName, theme, onToggleTheme }: NavbarProps) {
  const firstName = displayName?.trim().split(' ')[0]

  return (
    <nav className="sticky top-0 z-50 shadow-xl" style={{
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
    }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-md shadow-indigo-900/50">
              <GraduationCap size={17} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="block text-white font-semibold text-sm leading-tight">
                {firstName ? `Bem-vindo, ${firstName}` : 'Horas Complementares'}
              </span>
              {firstName && (
                <span className="block text-white/45 text-[11px] leading-tight">
                  Horas Complementares
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Tabs */}
          <div className="flex gap-0.5 overflow-x-auto flex-1 scrollbar-none">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={[
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0',
                  activeTab === id
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8',
                ].join(' ')}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.slice(0, 3)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
