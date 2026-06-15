const weeklyMiles = [
  { week: 'May W3', miles: 22 },
  { week: 'May W4', miles: 28 },
  { week: 'Jun W1', miles: 25 },
  { week: 'Jun W2', miles: 32 },
  { week: 'Jun W3', miles: 18 },
]

const recentWorkouts = [
  { date: 'Jun 14', type: 'Tempo Run', miles: 5.1, pace: '6:48/mi', rpe: 7 },
  { date: 'Jun 12', type: 'Intervals', miles: 5.8, pace: '6:02/mi', rpe: 9 },
  { date: 'Jun 10', type: 'Long Run',  miles: 10.2, pace: '7:55/mi', rpe: 5 },
  { date: 'Jun 8',  type: 'Easy Run',  miles: 4.0, pace: '8:30/mi', rpe: 3 },
]

const prs = [
  { event: '5K',    time: '17:42', date: 'May 2026' },
  { event: '8K',    time: '29:15', date: 'Apr 2026' },
  { event: '10K',   time: '37:08', date: 'Mar 2026' },
  { event: '1 Mile', time: '4:58', date: 'Feb 2026' },
]

const maxMiles = Math.max(...weeklyMiles.map(w => w.miles))

export default function Progress() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Progress</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Season overview</p>
      </div>

      {/* Weekly mileage chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Weekly Mileage</h2>
        <div className="flex items-end gap-2 h-24">
          {weeklyMiles.map(({ week, miles }) => (
            <div key={week} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-zinc-400">{miles}</span>
              <div
                className="w-full rounded-t-md bg-coach-600 transition-all"
                style={{ height: `${(miles / maxMiles) * 72}px` }}
              />
              <span className="text-[9px] text-zinc-600 text-center leading-tight">{week}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent workouts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Recent Workouts</h2>
        </div>
        {recentWorkouts.map((w, i) => (
          <div
            key={i}
            className={`px-4 py-3 flex items-center justify-between ${
              i < recentWorkouts.length - 1 ? 'border-b border-zinc-800/60' : ''
            }`}
          >
            <div>
              <p className="text-sm font-medium text-white">{w.type}</p>
              <p className="text-xs text-zinc-500">{w.date} · {w.miles} mi · {w.pace}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-600">RPE</span>
              <span
                className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                  w.rpe >= 8 ? 'bg-red-900/60 text-red-400' :
                  w.rpe >= 6 ? 'bg-orange-900/60 text-orange-400' :
                  'bg-emerald-900/60 text-emerald-400'
                }`}
              >
                {w.rpe}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* PRs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Personal Bests</h2>
        </div>
        {prs.map((pr, i) => (
          <div
            key={i}
            className={`px-4 py-3 flex items-center justify-between ${
              i < prs.length - 1 ? 'border-b border-zinc-800/60' : ''
            }`}
          >
            <span className="text-sm text-zinc-300">{pr.event}</span>
            <div className="text-right">
              <p className="text-sm font-bold text-coach-400">{pr.time}</p>
              <p className="text-xs text-zinc-600">{pr.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
