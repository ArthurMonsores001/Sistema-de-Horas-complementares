'use client'

import { TabId } from '@/lib/types'
import { LayoutDashboard, PlusCircle, FileText, Settings, GraduationCap } from 'lucide-react'

const TABS: { id: TabId; label: string; shortLabel: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',    label: 'Dashboard',     shortLabel: 'Início',  Icon: LayoutDashboard },
  { id: 'add',          label: 'Adicionar',     shortLabel: 'Adicionar', Icon: PlusCircle },
  { id: 'certificates', label: 'Certificados',  shortLabel: 'Certif.', Icon: FileText },
  { id: 'settings',     label: 'Configurações', shortLabel: 'Config.', Icon: Settings },
]

interface NavbarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  displayName?: string
}

export default function Navbar({ activeTab, onTabChange, displayName }: NavbarProps) {
  const firstName = displayName?.trim().split(' ')[0]

  return (
    <nav className="sticky top-0 z-50" style={{
      background: 'linear-gradient(135deg, #26040a 0%, #790E18 50%, #26040a 100%)',
    }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-2 sm:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-vinho-500 flex items-center justify-center shadow-md shadow-vinho-900/50">
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
            {TABS.map(({ id, label, shortLabel, Icon }) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-label={label}
                aria-current={activeTab === id ? 'page' : undefined}
                className={[
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 flex-1 sm:flex-none min-w-0 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-medium transition-all duration-150 whitespace-nowrap sm:flex-shrink-0',
                  activeTab === id
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8',
                ].join(' ')}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
