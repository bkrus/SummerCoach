import { useAthlete } from '../hooks/useAthlete'
import { buildStravaAuthUrl } from '../lib/strava'

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const todayWorkout = {
  type: 'Tempo Run',
  distance: '5 miles',
  pace: '6:45 / mile',
  effort: 'Threshold',
  notes: 'Warm up 1 mi easy, 3 mi at tempo effort, cool down 1 mi easy',
}

const weekStats = [
  { label: 'Miles', value: '18.4' },
  { label: 'Workouts', value: '4' },
  { label: 'Streak', value: '6d' },
]

export default function Home() {
  const { athlete, loading } = useAthlete()
  const firstName = athlete?.name.split(' ')[0] ?? 'Athlete'

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
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

      {/* Today's Workout */}
      <div className="rounded-2xl overflow-hidden border border-coach-700/40">
        <div className="bg-coach-600 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-coach-200 uppercase tracking-wider">Today's Workout</span>
          <span className="text-xs bg-coach-500/60 text-coach-100 px-2 py-0.5 rounded-full">{todayWorkout.effort}</span>
        </div>
        <div className="bg-zinc-900 px-4 py-4 space-y-2">
          <h2 className="text-xl font-bold text-white">{todayWorkout.type}</h2>
          <div className="flex gap-4">
            <span className="text-sm text-zinc-400">{todayWorkout.distance}</span>
            <span className="text-sm text-zinc-400">{todayWorkout.pace}</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{todayWorkout.notes}</p>
        </div>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-3 gap-3">
        {weekStats.map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-coach-400">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label} this week</p>
          </div>
        ))}
      </div>

      {/* AI Coach Insight */}
      <div className="rounded-2xl bg-gradient-to-br from-coach-900/60 to-zinc-900 border border-coach-700/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-coach-600 flex items-center justify-center text-xs font-bold">AI</div>
          <span className="text-sm font-semibold text-coach-300">Coach Insight</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          You're building aerobic base well. Your last two tempo runs showed good lactate threshold control.
          Keep today's effort honest — don't chase pace, chase feel.
        </p>
      </div>

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
