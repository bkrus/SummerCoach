import { useEffect, useState, useCallback } from 'react'
import { useAthlete } from '../hooks/useAthlete'
import { buildStravaAuthUrl } from '../lib/strava'
import { supabase } from '../lib/supabase'

type ReadinessStatus = 'green' | 'yellow' | 'red'

interface CoachingResponse {
  message: string
  readiness: ReadinessStatus | null
  generatedAt: string
  weeklyMiles: number
  hasRunToday: boolean
  hasLiftedToday: boolean
  todayRunSummary: {
    name: string
    distance_miles: number
    duration_minutes: number
    average_heartrate: number | null
    effort_level: string | null
  } | null
  todayLiftSummary: { name: string; duration_minutes: number } | null
}

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const READINESS_CFG: Record<
  ReadinessStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  green: {
    label: 'Ready',
    bg: 'bg-green-950/60',
    border: 'border-green-800/50',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  yellow: {
    label: 'Moderate',
    bg: 'bg-yellow-950/60',
    border: 'border-yellow-800/50',
    text: 'text-yellow-400',
    dot: 'bg-yellow-400',
  },
  red: {
    label: 'Recovery',
    bg: 'bg-red-950/60',
    border: 'border-red-800/50',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtSecs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function Home() {
  const { athlete, loading } = useAthlete()
  const firstName = athlete?.name.split(' ')[0] ?? 'Athlete'

  const [prData, setPrData] = useState<{ current: number | null; goal: number | null }>({
    current: null,
    goal: null,
  })

  const fetchPR = useCallback(async () => {
    const { data } = await supabase
      .from('athlete')
      .select('current_pr_seconds, goal_pr_seconds')
      .maybeSingle()
    if (data) {
      setPrData({ current: data.current_pr_seconds, goal: data.goal_pr_seconds })
    }
  }, [])

  const [coaching, setCoaching] = useState<CoachingResponse | null>(null)
  const [coachingLoading, setCoachingLoading] = useState(true)
  const [coachingError, setCoachingError] = useState(false)

  const fetchCoaching = useCallback(async () => {
    setCoachingLoading(true)
    setCoachingError(false)
    try {
      const res = await fetch('/api/coaching-message')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CoachingResponse
      setCoaching(data)
    } catch {
      setCoachingError(true)
    } finally {
      setCoachingLoading(false)
    }
  }, [])

  const [syncing, setSyncing] = useState(false)
  const [syncToast, setSyncToast] = useState<string | null>(null)

  const syncStrava = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json() as { newCount?: number; error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const label =
        data.newCount === 0
          ? 'Already up to date'
          : `Synced ${data.newCount} new activit${data.newCount === 1 ? 'y' : 'ies'}`
      setSyncToast(label)
      setTimeout(() => setSyncToast(null), 3500)
      void fetchCoaching()
      void fetchPR()
    } catch (err) {
      setSyncToast(`Sync failed: ${(err as Error).message}`)
      setTimeout(() => setSyncToast(null), 4000)
    } finally {
      setSyncing(false)
    }
  }, [fetchCoaching, fetchPR])

  useEffect(() => {
    void fetchCoaching()
    void fetchPR()
  }, [fetchCoaching, fetchPR])

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {syncToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-coach-700 border border-coach-500 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg animate-slide-in max-w-xs w-[calc(100%-2rem)] text-center">
          {syncToast}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-coach-400 font-medium">{today}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5 truncate">
            Good morning, {firstName}
          </h1>
        </div>
        {athlete?.strava_profile_url ? (
          <img
            src={athlete.strava_profile_url}
            alt={athlete.name}
            className="w-11 h-11 rounded-full object-cover border-2 border-coach-700/50 flex-shrink-0"
          />
        ) : (
          !loading && (
            <div className="w-11 h-11 rounded-full bg-coach-800 border-2 border-coach-700/50 flex-shrink-0 flex items-center justify-center">
              <span className="text-coach-300 font-semibold text-sm">
                {firstName[0]?.toUpperCase()}
              </span>
            </div>
          )
        )}
      </div>

      {/* Connect Strava banner */}
      {!loading && !athlete && (
        <a
          href={buildStravaAuthUrl()}
          className="flex items-center gap-3 rounded-2xl p-4 bg-[#FC4C02]/10 border border-[#FC4C02]/30 active:bg-[#FC4C02]/20 transition-colors"
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#FC4C02] flex items-center justify-center">
            <span className="text-white font-black text-base leading-none">S</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Connect Strava</p>
            <p className="text-xs text-zinc-400">Import your runs automatically</p>
          </div>
          <svg className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      )}

      {/* AI Coach Message */}
      <div className="rounded-2xl bg-gradient-to-br from-coach-900/60 to-zinc-900 border border-coach-700/30 overflow-hidden">
        {/* Card header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-coach-600 flex items-center justify-center text-xs font-bold text-white">
              AI
            </div>
            <span className="text-sm font-semibold text-coach-300">
              {coaching?.hasRunToday && coaching?.hasLiftedToday
                ? "Today's Training Summary"
                : coaching?.hasRunToday
                ? 'Run Analysis + Today\'s Plan'
                : 'Today\'s Coaching'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void syncStrava()}
              disabled={syncing || coachingLoading}
              className="flex items-center gap-1.5 text-xs text-[#FC4C02]/80 hover:text-[#FC4C02] disabled:opacity-40 transition-colors active:scale-95"
            >
              <svg
                className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {syncing ? 'Syncing…' : 'Sync Strava'}
            </button>
            <button
              onClick={() => { void fetchCoaching(); void fetchPR() }}
              disabled={coachingLoading}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors active:scale-95"
            >
              <svg
                className={`w-3.5 h-3.5 ${coachingLoading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-3">
          {coachingLoading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-4 h-4 border-2 border-coach-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-sm text-zinc-500 italic">Coach is thinking…</p>
            </div>
          ) : coachingError ? (
            <p className="text-sm text-zinc-500 italic">
              Couldn't load message — tap Refresh to try again.
            </p>
          ) : coaching ? (
            <>
              {coaching.readiness && (
                <ReadinessBadge status={coaching.readiness} />
              )}
              <p className="text-sm text-zinc-300 leading-relaxed">{coaching.message}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-600">
                  {coaching.weeklyMiles} mi this week
                </span>
                <span className="text-xs text-zinc-600">
                  Generated {formatTime(coaching.generatedAt)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-coach-400">
            {coaching ? coaching.weeklyMiles : '—'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Miles this week</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-coach-400">
            {prData.current != null ? fmtSecs(prData.current) : '—'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Current PR</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-coach-400">
            {prData.goal != null ? fmtSecs(prData.goal) : '—'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Goal PR</p>
        </div>
      </div>

      {/* Today's activity status */}
      {coaching && (
        <div className="flex flex-wrap gap-2 items-center">
          {coaching.hasRunToday && coaching.todayRunSummary && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-950/60 border border-green-800/40 text-xs font-medium text-green-400">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Run logged — {coaching.todayRunSummary.distance_miles} mi
            </span>
          )}
          {coaching.hasLiftedToday && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-950/60 border border-green-800/40 text-xs font-medium text-green-400">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Lift logged
            </span>
          )}
          {!coaching.hasRunToday && !coaching.hasLiftedToday && (
            <span className="text-xs text-zinc-600">No activities logged today</span>
          )}
        </div>
      )}

      {/* Upcoming */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Upcoming</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Long Run</p>
              <p className="text-xs text-zinc-500">Saturday · 10 miles</p>
            </div>
            <span className="text-xs text-zinc-600">3 days</span>
          </div>
          <div className="border-t border-zinc-800" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Invitational 5K</p>
              <p className="text-xs text-zinc-500">Jul 12 · Race Day</p>
            </div>
            <span className="text-xs text-coach-400 font-medium">27 days</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const cfg = READINESS_CFG[status]
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${cfg.bg} ${cfg.border}`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-semibold ${cfg.text}`}>
        Readiness: {cfg.label}
      </span>
    </div>
  )
}
