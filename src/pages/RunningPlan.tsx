import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.34

interface WeekDef {
  week: number
  label: string
  dateRange: string
  targetMiles: number | null
  start: Date
}

// Coach-defined schedule — not user-editable
const WEEKLY_SCHEDULE: WeekDef[] = [
  { week: 2,  label: 'wk2',      dateRange: 'This week',        targetMiles: 25,  start: new Date(2026, 5, 8)  },
  { week: 3,  label: 'wk3',      dateRange: 'June 15–21',       targetMiles: 30,  start: new Date(2026, 5, 15) },
  { week: 4,  label: 'wk4',      dateRange: 'June 22–28',       targetMiles: 34,  start: new Date(2026, 5, 22) },
  { week: 5,  label: 'wk5',      dateRange: 'June 29–July 5',   targetMiles: 38,  start: new Date(2026, 5, 29) },
  { week: 6,  label: 'wk6',      dateRange: 'July 6–12',        targetMiles: 42,  start: new Date(2026, 6, 6)  },
  { week: 7,  label: 'wk7',      dateRange: 'July 13–19',       targetMiles: 45,  start: new Date(2026, 6, 13) },
  { week: 8,  label: 'wk8',      dateRange: 'July 20–26',       targetMiles: 48,  start: new Date(2026, 6, 20) },
  { week: 9,  label: 'wk9',      dateRange: 'July 27–Aug 2',    targetMiles: 50,  start: new Date(2026, 6, 27) },
  { week: 10, label: 'deadweek', dateRange: 'Aug 3–9',          targetMiles: null, start: new Date(2026, 7, 3) },
]

const TEAM_DAY_INDICES = new Set([1, 3, 5])  // Tue, Thu, Sat (0 = Mon)
const TEAM_MILES_ESTIMATE = 18               // 3 team days × ~6 mi

const SOLO_DAYS = [
  { runType: 'Easy run', pct: 0.25 },  // Mon
  { runType: 'Workout',  pct: 0.20 },  // Wed
  { runType: 'Easy run', pct: 0.30 },  // Fri
  { runType: 'Long run', pct: 0.25 },  // Sun
] as const

interface ActivityData {
  miles: number
  movingTimeSec: number
}

interface DayPlan {
  dayLabel: string
  dateLabel: string
  isTeam: boolean
  runType?: string
  suggestedMiles?: number
  isToday: boolean
  actual?: { miles: number; pace: string | null }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function weekEnd(index: number): Date {
  if (index < WEEKLY_SCHEDULE.length - 1) {
    const d = new Date(WEEKLY_SCHEDULE[index + 1].start)
    d.setDate(d.getDate() - 1)
    return d
  }
  return new Date(2026, 7, 9) // Aug 9
}

function getStatus(index: number): 'past' | 'current' | 'future' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = WEEKLY_SCHEDULE[index].start
  const end = weekEnd(index)
  if (today < start) return 'future'
  if (today > end) return 'past'
  return 'current'
}

// Parse "2026-06-26" or "2026-06-26T10:30:00Z" safely as a local midnight date
function parseDateLocal(s: string): Date {
  const [y, m, d] = s.substring(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function weekNumForDate(date: Date): number | null {
  for (let i = 0; i < WEEKLY_SCHEDULE.length; i++) {
    if (date >= WEEKLY_SCHEDULE[i].start && date <= weekEnd(i)) {
      return WEEKLY_SCHEDULE[i].week
    }
  }
  return null
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatPace(miles: number, seconds: number): string | null {
  if (miles <= 0 || seconds <= 0) return null
  const paceSec = seconds / miles
  const min = Math.floor(paceSec / 60)
  const sec = Math.round(paceSec % 60)
  return `${min}:${String(sec).padStart(2, '0')}/mi`
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildWeekDays(
  weekStart: Date,
  targetMiles: number,
  activitiesByDate: Record<string, ActivityData>,
): DayPlan[] {
  const soloMiles = Math.max(0, targetMiles - TEAM_MILES_ESTIMATE)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let soloIdx = 0

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    const dateStr = toDateStr(date)
    const isTeam = TEAM_DAY_INDICES.has(i)
    const isToday = date.getTime() === today.getTime()
    const act = activitiesByDate[dateStr]
    const actual = act
      ? { miles: act.miles, pace: formatPace(act.miles, act.movingTimeSec) }
      : undefined
    const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`

    if (isTeam) {
      return { dayLabel: DAY_LABELS[i], dateLabel, isTeam: true as const, isToday, actual }
    }
    const solo = SOLO_DAYS[soloIdx++]
    return {
      dayLabel: DAY_LABELS[i],
      dateLabel,
      isTeam: false as const,
      runType: solo.runType,
      suggestedMiles: soloMiles > 0 ? parseFloat((soloMiles * solo.pct).toFixed(1)) : undefined,
      isToday,
      actual,
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RunningPlan() {
  const [milesByWeek, setMilesByWeek] = useState<Record<number, number>>({})
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, ActivityData>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Single query for the entire season — computed per-week in JS
      const { data } = await supabase
        .from('activities')
        .select('start_date, distance_meters, moving_time_seconds')
        .gte('start_date', '2026-06-08')
        .lt('start_date', '2026-08-10')

      if (!data) { setLoading(false); return }

      const accWeek: Record<number, number> = {}
      const accDate: Record<string, ActivityData> = {}
      for (const act of data) {
        if (!act.distance_meters) continue
        const date = parseDateLocal(act.start_date)
        const miles = act.distance_meters / METERS_PER_MILE
        const wk = weekNumForDate(date)
        if (wk !== null) accWeek[wk] = (accWeek[wk] ?? 0) + miles
        const ds = toDateStr(date)
        if (!accDate[ds]) accDate[ds] = { miles: 0, movingTimeSec: 0 }
        accDate[ds].miles += miles
        accDate[ds].movingTimeSec += act.moving_time_seconds ?? 0
      }
      setMilesByWeek(accWeek)
      setActivitiesByDate(accDate)
      setLoading(false)
    }
    void load()
  }, [])

  const currentIdx = WEEKLY_SCHEDULE.findIndex((_, i) => getStatus(i) === 'current')
  const currentWeek = currentIdx >= 0 ? WEEKLY_SCHEDULE[currentIdx] : null
  const currentMiles = currentWeek ? (milesByWeek[currentWeek.week] ?? 0) : 0
  const weekDays = currentWeek && currentWeek.targetMiles !== null && !loading
    ? buildWeekDays(currentWeek.start, currentWeek.targetMiles, activitiesByDate)
    : []

  return (
    <div className="px-4 pt-6 pb-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Running Plan</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Base phase · Summer 2026</p>
      </div>

      {/* ── This Week card ─────────────────────────────────────────────────── */}
      {currentWeek ? (
        <div className="rounded-2xl bg-zinc-900 border border-[#1E6B3C]/50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-[#2d9a57] uppercase tracking-wider mb-0.5">This Week</p>
              <p className="text-lg font-bold text-white leading-tight">
                {currentWeek.label} · {currentWeek.dateRange}
              </p>
            </div>
            {currentWeek.targetMiles && (
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-white tabular-nums">{currentWeek.targetMiles}</p>
                <p className="text-xs text-zinc-500 mt-0.5">mi target</p>
              </div>
            )}
          </div>

          {currentWeek.targetMiles === null ? (
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/40 px-4 py-3 text-center">
              <p className="text-sm font-medium text-zinc-400">Recovery week — no mileage target</p>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-3.5 h-3.5 border-2 border-coach-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-xs text-zinc-500 italic">Loading mileage…</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Progress bar + stats */}
              <div className="space-y-2">
                <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (currentMiles / currentWeek.targetMiles) * 100).toFixed(1)}%`,
                      background: '#1E6B3C',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-300">
                    <span className="font-bold text-white tabular-nums">{currentMiles.toFixed(1)}</span>
                    {' '}of {currentWeek.targetMiles} miles
                  </p>
                  <p className="text-sm font-bold text-[#2d9a57] tabular-nums">
                    {Math.min(100, Math.round((currentMiles / currentWeek.targetMiles) * 100))}%
                  </p>
                </div>
              </div>

              {/* Day-by-day breakdown */}
              {weekDays.length > 0 && (
                <div className="border-t border-zinc-800 pt-1">
                  {weekDays.map((day, i) => (
                    <DayRow key={i} day={day} isLast={i === 6} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500">
            {new Date() < WEEKLY_SCHEDULE[0].start ? 'Season starts June 8' : 'Season concluded'}
          </p>
        </div>
      )}

      {/* ── Season overview ────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Season Overview</p>
        <div className="space-y-2">
          {WEEKLY_SCHEDULE.map((wk, i) => {
            const status = getStatus(i)
            const actual = milesByWeek[wk.week] ?? 0
            const isDeadWeek = wk.label === 'deadweek'

            // ── Dead week ──
            if (isDeadWeek) {
              return (
                <div
                  key={wk.week}
                  className={`rounded-2xl border px-4 py-3.5 ${
                    status === 'current'
                      ? 'bg-zinc-800/60 border-[#1E6B3C]/30'
                      : status === 'past'
                      ? 'bg-zinc-900 border-zinc-800'
                      : 'bg-zinc-900/40 border-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${status === 'future' ? 'text-zinc-500' : 'text-white'}`}>
                        Dead Week / Recovery
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">{wk.dateRange}</p>
                    </div>
                    {status === 'current' && (
                      <span className="text-[10px] font-bold text-[#2d9a57] px-2 py-0.5 rounded-full border border-[#1E6B3C]/40 bg-[#1E6B3C]/10 uppercase tracking-wide">
                        Now
                      </span>
                    )}
                    {status !== 'current' && (
                      <span className="text-xs text-zinc-600">No target</span>
                    )}
                  </div>
                </div>
              )
            }

            // ── Current week ──
            if (status === 'current') {
              const pct = wk.targetMiles ? Math.min(100, (actual / wk.targetMiles) * 100) : 0
              return (
                <div
                  key={wk.week}
                  className="rounded-2xl border border-[#1E6B3C]/40 bg-zinc-900 overflow-hidden flex"
                >
                  <div className="w-1 bg-[#1E6B3C] flex-shrink-0" />
                  <div className="flex-1 px-4 py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{wk.label}</p>
                          <span className="text-[10px] font-bold text-[#2d9a57] px-1.5 py-0.5 rounded-full border border-[#1E6B3C]/40 bg-[#1E6B3C]/10 uppercase tracking-wide">
                            Now
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{wk.dateRange}</p>
                      </div>
                      {wk.targetMiles && (
                        <p className="text-sm font-bold text-white tabular-nums text-right flex-shrink-0">
                          {loading ? '—' : actual.toFixed(1)}
                          <span className="text-zinc-500 font-normal"> / {wk.targetMiles} mi</span>
                        </p>
                      )}
                    </div>
                    {wk.targetMiles && !loading && (
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct.toFixed(1)}%`, background: '#1E6B3C' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            // ── Past week ──
            if (status === 'past') {
              const metTarget = wk.targetMiles !== null && actual >= wk.targetMiles
              const missedTarget = wk.targetMiles !== null && actual < wk.targetMiles && actual > 0
              const noData = actual === 0
              return (
                <div
                  key={wk.week}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-300">{wk.label}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{wk.dateRange}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      {!loading && (
                        <p className="text-sm font-semibold tabular-nums text-zinc-300">
                          {noData ? '—' : actual.toFixed(1)}
                          {!noData && <span className="text-zinc-600 font-normal"> mi</span>}
                        </p>
                      )}
                      {!loading && metTarget && (
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {!loading && missedTarget && (
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {wk.targetMiles && !loading && actual > 0 && (
                    <div className="mt-2.5 space-y-1">
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (actual / wk.targetMiles) * 100).toFixed(1)}%`,
                            background: metTarget ? '#1E6B3C' : '#b45309',
                          }}
                        />
                      </div>
                      <p className="text-xs text-zinc-600">Target: {wk.targetMiles} mi</p>
                    </div>
                  )}
                  {wk.targetMiles && !loading && noData && (
                    <p className="text-xs text-zinc-600 mt-1">Target: {wk.targetMiles} mi · No activities logged</p>
                  )}
                </div>
              )
            }

            // ── Future week ──
            return (
              <div
                key={wk.week}
                className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 px-4 py-3.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-500">{wk.label}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{wk.dateRange}</p>
                  </div>
                  {wk.targetMiles && (
                    <p className="text-sm font-medium text-zinc-600 tabular-nums">{wk.targetMiles} mi</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ─── Day Row ──────────────────────────────────────────────────────────────────

function DayRow({ day, isLast }: { day: DayPlan; isLast: boolean }) {
  return (
    <div className={`flex items-start gap-2 py-2 ${!isLast ? 'border-b border-zinc-800/40' : ''}`}>
      {/* Today indicator dot — takes up space even when invisible so columns stay aligned */}
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${day.isToday ? 'bg-[#2d9a57]' : 'invisible'}`} />

      {/* Day name + date */}
      <div className="w-10 flex-shrink-0">
        <p className={`text-xs font-semibold leading-none ${day.isToday ? 'text-white' : 'text-zinc-400'}`}>
          {day.dayLabel}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5 tabular-nums">{day.dateLabel}</p>
      </div>

      {/* Workout type chip + suggested distance + actual */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {day.isTeam ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-400">
              Team Training
            </span>
          ) : (
            <>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                day.runType === 'Long run'
                  ? 'bg-blue-950/60 border border-blue-800/50 text-blue-400'
                  : day.runType === 'Workout'
                  ? 'bg-orange-950/60 border border-orange-800/50 text-orange-400'
                  : 'bg-coach-900/60 border border-coach-700/50 text-coach-400'
              }`}>
                {day.runType}
              </span>
              {day.suggestedMiles !== undefined && (
                <span className="text-[10px] text-zinc-500">~{day.suggestedMiles} mi</span>
              )}
            </>
          )}
        </div>
        {day.actual && (
          <p className="text-[11px] text-[#2d9a57] mt-0.5 tabular-nums">
            {day.actual.miles.toFixed(1)} mi{day.actual.pace ? ` · ${day.actual.pace}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
