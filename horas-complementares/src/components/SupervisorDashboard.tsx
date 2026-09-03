'use client'

import { useMemo } from 'react'
import { StudentProfile } from '@/lib/types'
import { Clock, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react'

const STALE_DAYS_THRESHOLD = 15
const WEEKS_WINDOW = 8

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day // Monday as week start
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + diff)
  return d
}

interface WeekBucket {
  label: string
  approved: number
  rejected: number
}

export default function SupervisorDashboard({ profiles }: { profiles: StudentProfile[] }) {
  const allCerts = useMemo(
    () => profiles.flatMap(p => p.certificates.map(c => ({ cert: c, profile: p }))),
    [profiles],
  )

  const totalPending = useMemo(
    () => allCerts.filter(({ cert }) => cert.status === 'pending').length,
    [allCerts],
  )

  const totalApproved = useMemo(
    () => profiles.filter(p => p.certificates.some(c => c.status === 'approved')).length,
    [profiles],
  )

  const weeklyBuckets = useMemo<WeekBucket[]>(() => {
    const now = new Date()
    const buckets: WeekBucket[] = []
    for (let i = WEEKS_WINDOW - 1; i >= 0; i--) {
      const weekStart = startOfWeek(new Date(now.getTime() - i * 7 * 86_400_000))
      buckets.push({
        label: weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        approved: 0,
        rejected: 0,
      })
    }
    const firstWeekStart = startOfWeek(new Date(now.getTime() - (WEEKS_WINDOW - 1) * 7 * 86_400_000))

    for (const { cert } of allCerts) {
      if (cert.status !== 'approved' && cert.status !== 'rejected') continue
      if (!cert.updatedAt) continue
      const updated = new Date(cert.updatedAt)
      if (updated < firstWeekStart) continue
      const weekIndex = Math.floor((startOfWeek(updated).getTime() - firstWeekStart.getTime()) / (7 * 86_400_000))
      const bucket = buckets[weekIndex]
      if (!bucket) continue
      if (cert.status === 'approved') bucket.approved++
      else bucket.rejected++
    }
    return buckets
  }, [allCerts])

  const staleStudents = useMemo(() => {
    const now = Date.now()
    const seen = new Map<string, { name: string; registration: string; days: number }>()
    for (const { cert, profile } of allCerts) {
      if (cert.status !== 'pending' || !cert.submittedAt) continue
      const days = Math.floor((now - new Date(cert.submittedAt).getTime()) / 86_400_000)
      if (days < STALE_DAYS_THRESHOLD) continue
      const existing = seen.get(profile.registration)
      if (!existing || days > existing.days) {
        seen.set(profile.registration, { name: profile.student.name, registration: profile.registration, days })
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.days - a.days)
  }, [allCerts])

  const maxWeekCount = Math.max(1, ...weeklyBuckets.map(b => b.approved + b.rejected))

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><Clock size={13} /> Pendentes</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{totalPending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><CheckCircle2 size={13} /> Aprovados</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{totalApproved}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><AlertTriangle size={13} /> Alunos com pendência antiga</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{staleStudents.length}</p>
        </div>
      </div>

      {/* Weekly approved/rejected */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-3">
          <TrendingUp size={15} />
          Avaliados por semana (últimas {WEEKS_WINDOW})
        </h3>
        <div className="flex items-end gap-2 h-32">
          {weeklyBuckets.map(bucket => (
            <div key={bucket.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <div className="w-full flex flex-col justify-end gap-0.5 flex-1">
                {bucket.rejected > 0 && (
                  <div
                    className="w-full bg-red-400 rounded-sm"
                    style={{ height: `${(bucket.rejected / maxWeekCount) * 100}%` }}
                    title={`${bucket.rejected} reprovado(s)`}
                  />
                )}
                {bucket.approved > 0 && (
                  <div
                    className="w-full bg-green-500 rounded-sm"
                    style={{ height: `${(bucket.approved / maxWeekCount) * 100}%` }}
                    title={`${bucket.approved} aprovado(s)`}
                  />
                )}
              </div>
              <span className="text-[10px] text-gray-400">{bucket.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Aprovado</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> Reprovado</span>
        </div>
      </div>

    </div>
  )
}
