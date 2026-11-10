import type { Metadata } from 'next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://horas-complementares-phi.vercel.app'
const shareTitle = 'Sistema de Horas Complementares da Universidade de Vassouras'
const description = 'Gerencie suas horas complementares acadêmicas. Universidade de Vassouras.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Horas Complementares',
  description,
  openGraph: {
    title: shareTitle,
    description,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Horas Complementares',
  },
  twitter: {
    card: 'summary_large_image',
    title: shareTitle,
    description,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
