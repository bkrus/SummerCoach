import { useState } from 'react'

type WorkoutType = 'Easy' | 'Tempo' | 'Intervals' | 'Long' | 'Rest' | 'Race'

interface DayPlan {
  day: string
  type: WorkoutType
  distance?: string
  details: string
}

const typeColors: Record<WorkoutType, string> = {
  Easy:      'bg-emerald-900/40 text-emerald-400 border-emerald-800/50',
  Tempo:     'bg-orange-900/40 text-orange-400 border-orange-800/50',
  Intervals: 'bg-red-900/40 text-red-400 border-red-800/50',
  Long:      'bg-blue-900/40 text-blue-400 border-blue-800/50',
  Rest:      'bg-zinc-800/60 text-zinc-500 border-zinc-700/50',
  Race:      'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
}

const weeks: DayPlan[][] = [
  [
    { day: 'Mon', type: 'Easy',      distance: '4 mi',  details: 'Easy aerobic, conversational pace' },
    { day: 'Tue', type: 'Tempo',     distance: '5 mi',  details: '1 mi WU + 3 mi @ 6:45 + 1 mi CD' },
    { day: 'Wed', type: 'Easy',      distance: '3 mi',  details: 'Recovery run, very easy effort' },
    { day: 'Thu', type: 'Intervals', distance: '5 mi',  details: '6×800m @ 5K pace, 90s rest' },
    { day: 'Fri', type: 'Rest',                         details: 'Full rest or 20 min walk' },
    { day: 'Sat', type: 'Long',      distance: '10 mi', details: 'Aerobic long run, Z2 effort throughout' },
    { day: 'Sun', type: 'Easy',      distance: '3 mi',  details: 'Recovery jog + mobility work' },
  ],
  [
    { day: 'Mon', type: 'Easy',      distance: '5 mi',  details: 'Easy aerobic, conversational pace' },
    { day: 'Tue', type: 'Intervals', distance: '6 mi',  details: '5×1K @ mile pace, 2 min rest' },
    { day: 'Wed', type: 'Easy',      distance: '4 mi',  details: 'Recovery run' },
    { day: 'Thu', type: 'Tempo',     distance: '6 mi',  details: '1 mi WU + 4 mi @ threshold + 1 mi CD' },
    { day: 'Fri', type: 'Rest',                         details: 'Full rest' },
    { day: 'Sat', type: 'Long',      distance: '12 mi', details: 'Long aerobic — last 2 mi at marathon effort' },
    { day: 'Sun', type: 'Easy',      distance: '3 mi',  details: 'Easy shakeout' },
  ],
]

export default function RunningPlan() {
  const [weekIdx, setWeekIdx] = useState(0)
  const plan = weeks[weekIdx]

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Header + week selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Running Plan</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Base phase · 8-week block</p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setWeekIdx(i => Math.max(0, i - 1))}
            disabled={weekIdx === 0}
            className="p-1.5 rounded-lg disabled:opacity-30 text-zinc-400 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-white px-1 min-w-[4rem] text-center">
            Week {weekIdx + 1}
          </span>
          <button
            onClick={() => setWeekIdx(i => Math.min(weeks.length - 1, i + 1))}
            disabled={weekIdx === weeks.length - 1}
            className="p-1.5 rounded-lg disabled:opacity-30 text-zinc-400 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekly total */}
      <div className="bg-coach-900/40 border border-coach-700/30 rounded-xl px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm text-coach-300">Weekly target</span>
        <span className="text-sm font-bold text-coach-400">
          {plan.reduce((sum, d) => sum + (d.distance ? parseFloat(d.distance) : 0), 0)} miles
        </span>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {plan.map(({ day, type, distance, details }) => (
          <div key={day} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 text-center flex-shrink-0">
              <p className="text-xs font-semibold text-zinc-500 uppercase">{day}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColors[type]}`}>
                  {type}
                </span>
                {distance && (
                  <span className="text-xs text-zinc-500">{distance}</span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate">{details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
