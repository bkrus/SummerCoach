import { useState } from 'react'

interface Exercise {
  name: string
  sets: string
  focus: string
}

interface Session {
  day: string
  name: string
  duration: string
  exercises: Exercise[]
}

const sessions: Session[] = [
  {
    day: 'Tuesday',
    name: 'Power & Stability',
    duration: '35 min',
    exercises: [
      { name: 'Single-leg Squat', sets: '3×8 each', focus: 'Glute strength' },
      { name: 'Romanian Deadlift', sets: '3×10', focus: 'Posterior chain' },
      { name: 'Step-ups', sets: '3×10 each', focus: 'Hip drive' },
      { name: 'Calf Raises', sets: '3×15', focus: 'Ankle stability' },
      { name: 'Dead Bug', sets: '3×10', focus: 'Core stability' },
      { name: 'Hip Flexor Stretch', sets: '3×30s', focus: 'Mobility' },
    ],
  },
  {
    day: 'Friday',
    name: 'Core & Plyometrics',
    duration: '30 min',
    exercises: [
      { name: 'Box Jumps', sets: '4×6', focus: 'Power development' },
      { name: 'Plank Variations', sets: '3×45s', focus: 'Core endurance' },
      { name: 'Lateral Band Walks', sets: '3×15 each', focus: 'Hip abductors' },
      { name: 'Bounding', sets: '4×20m', focus: 'Running economy' },
      { name: 'Glute Bridge', sets: '3×12', focus: 'Posterior activation' },
      { name: 'Foam Roll', sets: '5 min', focus: 'Recovery' },
    ],
  },
]

export default function LiftingPlan() {
  const [openSession, setOpenSession] = useState<number | null>(0)

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Lifting Plan</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Strength &amp; conditioning · 2×/week</p>
      </div>

      {/* Philosophy */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Sessions are designed to build running-specific strength, not hypertrophy.
          Prioritize form and control over load.
        </p>
      </div>

      {/* Sessions */}
      <div className="space-y-3">
        {sessions.map((session, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <button
              className="w-full px-4 py-4 flex items-center justify-between text-left"
              onClick={() => setOpenSession(openSession === i ? null : i)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-coach-400 uppercase tracking-wider">
                    {session.day}
                  </span>
                  <span className="text-xs text-zinc-600">{session.duration}</span>
                </div>
                <p className="text-base font-semibold text-white mt-0.5">{session.name}</p>
              </div>
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className={`w-5 h-5 text-zinc-500 transition-transform ${openSession === i ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {openSession === i && (
              <div className="border-t border-zinc-800">
                {session.exercises.map((ex, j) => (
                  <div
                    key={j}
                    className={`px-4 py-3 flex items-center justify-between ${
                      j < session.exercises.length - 1 ? 'border-b border-zinc-800/60' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{ex.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{ex.focus}</p>
                    </div>
                    <span className="text-xs font-semibold text-zinc-400 tabular-nums">{ex.sets}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
