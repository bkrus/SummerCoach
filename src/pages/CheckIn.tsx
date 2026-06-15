import { useState } from 'react'

interface Rating {
  label: string
  key: 'sleep' | 'energy' | 'soreness'
  emoji: string[]
  description: string
}

const ratings: Rating[] = [
  {
    label: 'Sleep',
    key: 'sleep',
    emoji: ['😫', '😪', '😐', '😊', '😴'],
    description: 'How well did you sleep?',
  },
  {
    label: 'Energy',
    key: 'energy',
    emoji: ['💀', '😓', '😐', '⚡', '🔥'],
    description: 'How is your energy level?',
  },
  {
    label: 'Soreness',
    key: 'soreness',
    emoji: ['🤕', '😣', '😐', '💪', '✅'],
    description: 'How sore / fresh do you feel?',
  },
]

type Scores = { sleep: number; energy: number; soreness: number }

export default function CheckIn() {
  const [scores, setScores] = useState<Scores>({ sleep: 3, energy: 3, soreness: 3 })
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    // Will POST to backend / store in state later
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2500)
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Daily Check-in</h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Rating cards */}
      {ratings.map(({ label, key, emoji, description }) => (
        <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-zinc-500">{description}</p>
            </div>
            <span className="text-2xl">{emoji[scores[key] - 1]}</span>
          </div>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                onClick={() => setScores(s => ({ ...s, [key]: v }))}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  scores[key] === v
                    ? 'bg-coach-600 text-white'
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Notes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <label className="text-sm font-semibold text-white block mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="How are you feeling? Any aches, life stress, motivation notes..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-coach-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
          submitted
            ? 'bg-coach-500 text-white scale-95'
            : 'bg-coach-600 hover:bg-coach-500 active:scale-95 text-white'
        }`}
      >
        {submitted ? '✓ Check-in Saved!' : 'Save Check-in'}
      </button>
    </div>
  )
}
