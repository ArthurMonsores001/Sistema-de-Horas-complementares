'use client'

import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/passwordRules'

export default function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1" aria-label="Requisitos da senha">
      {PASSWORD_RULES.map(rule => {
        const ok = rule.test(password)
        return (
          <li key={rule.id} className={['flex items-center gap-2 text-xs transition-colors', ok ? 'text-green-700' : 'text-gray-500'].join(' ')}>
            {ok ? <Check size={13} className="shrink-0" /> : <Circle size={13} className="shrink-0 text-gray-300" />}
            <span>{rule.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
