import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Horas Complementares',
  description: 'Gerencie suas horas complementares acadêmicas — Universidade de Vassouras',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
