import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAthlete } from '../hooks/useAthlete'
import type { ReadinessStatus } from '../lib/database.types'

const SLEEP_OPTIONS = ['<5', '5-6', '6-7', '7-8', '8+'] as const
type SleepOption = typeof SLEEP_OPTIONS[number]

const SLEEP_HOURS: Record<SleepOption, number> = {
  '<5': 4.5,
  '5-6': 5.5,
  '6-7': 6.5,
  '7-8': 7.5,
  '8+': 8.5,
}

const PAIN_OPTIONS = ['None', 'Shin splints', 'Knee', 'Hip', 'Foot', 'Other'] as const

const LEG_LABELS = ['', 'Destroyed', 'Very sore', 'Some fatigue', 'Pretty good', 'Fresh']
const ENERGY_LABELS = ['', 'Exhausted', 'Low', 'Okay', 'Good', 'Great']

const TOTAL_STEPS = 5

function calcReadiness(leg: number, energy: number, sleepHours: number): ReadinessStatus {
  if (leg >= 4 && energy >= 4 && sleepHours >= 7) return 'green'
  if (leg >= 2 && energy >= 2 && sleepHours >= 5) return 'yellow'
  return 'red'
}

type CheckinRow = {
  id: string
  date: string
  leg_fatigue: number | null
  energy_level: number | null
  sleep_hours: number | null
  pain_areas: string[] | null
  notes: string | null
}

type Screen = 'loading' | 'already-checked-in' | 'wizard' | 'completed'

export default function CheckIn() {
  const navigate = useNavigate()
  const { athlete } = useAthlete()
  const firstName = athlete?.name.split(' ')[0] ?? 'Athlete'
  const today = new Date().toISOString().split('T')[0]

  const [screen, setScreen] = useState<Screen>('loading')
  const [existingCheckin, setExistingCheckin] = useState<CheckinRow | null>(null)
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null)

  const [step, setStep] = useState(0)
  const [legFatigue, setLegFatigue] = useState<number | null>(null)
  const [energyLevel, setEnergyLevel] = useState<number | null>(null)
  const [sleepOption, setSleepOption] = useState<SleepOption | null>(null)
  const [painAreas, setPainAreas] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)

  useEffect(() => {
    async function checkExisting() {
      const { data } = await supabase
        .from('checkins')
        .select('id, date, leg_fatigue, energy_level, sleep_hours, pain_areas, notes')
        .eq('date', today)
        .maybeSingle()

      if (data) {
        setExistingCheckin(data as CheckinRow)
        setScreen('already-checked-in')
      } else {
        setScreen('wizard')
      }
    }
    void checkExisting()
  }, [today])

  function togglePain(area: string) {
    if (area === 'None') {
      setPainAreas(['None'])
      return
    }
    setPainAreas(prev => {
      const without = prev.filter(a => a !== 'None')
      return without.includes(area) ? without.filter(a => a !== area) : [...without, area]
    })
  }

  async function submit() {
    if (!legFatigue || !energyLevel || !sleepOption) return
    setSaving(true)
    const sleepHours = SLEEP_HOURS[sleepOption]
    const status = calcReadiness(legFatigue, energyLevel, sleepHours)
    const payload = {
      date: today,
      leg_fatigue: legFatigue,
      energy_level: energyLevel,
      sleep_hours: sleepHours,
      pain_areas: painAreas.length > 0 ? painAreas : ['None'],
      notes: notes.trim() || null,
    }
    if (isUpdate && existingCheckin) {
      await supabase.from('checkins').update(payload).eq('id', existingCheckin.id)
    } else {
      await supabase.from('checkins').insert(payload)
    }
    setReadiness(status)
    setSaving(false)
    setScreen('completed')
  }

  function startUpdate() {
    if (existingCheckin) {
      setLegFatigue(existingCheckin.leg_fatigue)
      setEnergyLevel(existingCheckin.energy_level)
      if (existingCheckin.sleep_hours != null) {
        const found = (Object.entries(SLEEP_HOURS) as [SleepOption, number][]).find(
          ([, v]) => v === existingCheckin.sleep_hours
        )
        if (found) setSleepOption(found[0])
      }
      setPainAreas(existingCheckin.pain_areas ?? [])
      setNotes(existingCheckin.notes ?? '')
    }
    setIsUpdate(true)
    setStep(0)
    setScreen('wizard')
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-coach-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Already checked in ──────────────────────────────────────────────────────

  if (screen === 'already-checked-in' && existingCheckin) {
    const legLabel = LEG_LABELS[existingCheckin.leg_fatigue ?? 0] ?? '—'
    const energyLabel = ENERGY_LABELS[existingCheckin.energy_level ?? 0] ?? '—'
    const sleepLabel = existingCheckin.sleep_hours != null
      ? ((Object.entries(SLEEP_HOURS) as [SleepOption, number][]).find(([, v]) => v === existingCheckin.sleep_hours)?.[0] ?? '—')
      : '—'
    const existingStatus =
      existingCheckin.leg_fatigue && existingCheckin.energy_level && existingCheckin.sleep_hours
        ? calcReadiness(existingCheckin.leg_fatigue, existingCheckin.energy_level, existingCheckin.sleep_hours)
        : null

    return (
      <div className="px-4 pt-6 pb-4 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Already checked in</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {existingStatus && <ReadinessBadge status={existingStatus} />}

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <SummaryRow label="Legs" value={`${existingCheckin.leg_fatigue}/5 — ${legLabel}`} />
          <SummaryRow label="Energy" value={`${existingCheckin.energy_level}/5 — ${energyLabel}`} />
          <SummaryRow label="Sleep" value={`${sleepLabel} hrs`} />
          {existingCheckin.pain_areas && existingCheckin.pain_areas.length > 0 && (
            <SummaryRow label="Pain" value={existingCheckin.pain_areas.join(', ')} />
          )}
          {existingCheckin.notes && (
            <SummaryRow label="Notes" value={existingCheckin.notes} />
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 rounded-2xl bg-coach-600 hover:bg-coach-500 active:scale-95 text-white font-semibold text-sm transition-all"
          >
            See Today's Workout
          </button>
          <button
            onClick={startUpdate}
            className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 font-medium text-sm transition-all"
          >
            Update Check-in
          </button>
        </div>
      </div>
    )
  }

  // ─── Completed ───────────────────────────────────────────────────────────────

  if (screen === 'completed' && readiness) {
    const conf = {
      green: { emoji: '✅', title: 'Ready to go!', sub: "You're looking fresh — let's build on it." },
      yellow: { emoji: '⚡', title: 'Take it steady', sub: 'Not your best, but manageable. Adjust if needed.' },
      red: { emoji: '🔴', title: 'Recovery day', sub: 'Your body needs rest. Light movement only today.' },
    }[readiness]
    return (
      <div className="px-4 pt-12 pb-4 flex flex-col items-center gap-6 animate-slide-in">
        <div className="text-6xl">{conf.emoji}</div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">{conf.title}</h1>
          <p className="text-sm text-zinc-400 max-w-xs">{conf.sub}</p>
        </div>
        <ReadinessBadge status={readiness} wide />
        <button
          onClick={() => navigate('/')}
          className="w-full py-3.5 rounded-2xl bg-coach-600 hover:bg-coach-500 active:scale-95 text-white font-semibold text-sm transition-all"
        >
          See Today's Workout
        </button>
      </div>
    )
  }

  // ─── Wizard ──────────────────────────────────────────────────────────────────

  const progress = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <div className="flex flex-col h-full">
      {/* Progress header */}
      <div className="px-4 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-coach-400">
            {isUpdate ? 'Updating' : 'Check-in'} · {step + 1} of {TOTAL_STEPS}
          </span>
          <span className="text-xs text-zinc-600">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-coach-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Coach intro — only on step 0 */}
      {step === 0 && (
        <div className="px-4 mb-1 flex-shrink-0 animate-slide-in">
          <div className="bg-coach-900/40 border border-coach-800/50 rounded-2xl px-4 py-3">
            <p className="text-coach-300 text-sm">
              Good morning {firstName} — quick check in before I build today's workout
            </p>
          </div>
        </div>
      )}

      {/* Animated question area */}
      <div className="flex-1 px-4 overflow-y-auto pb-8">
        <div key={step} className="animate-slide-in pt-4">

          {step === 0 && (
            <RatingStep
              question="How are your legs feeling?"
              value={legFatigue}
              labels={LEG_LABELS}
              onSelect={v => { setLegFatigue(v); setTimeout(() => setStep(1), 220) }}
            />
          )}

          {step === 1 && (
            <RatingStep
              question="How's your energy level?"
              value={energyLevel}
              labels={ENERGY_LABELS}
              onSelect={v => { setEnergyLevel(v); setTimeout(() => setStep(2), 220) }}
            />
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-white leading-snug">
                How many hours did you sleep last night?
              </h2>
              <div className="flex gap-2">
                {SLEEP_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setSleepOption(opt); setTimeout(() => setStep(3), 220) }}
                    className={`flex-1 py-5 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${
                      sleepOption === opt
                        ? 'bg-coach-700 border-coach-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white leading-snug">
                  Any pain or soreness worth flagging?
                </h2>
                <p className="text-sm text-zinc-500 mt-1">Select all that apply</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PAIN_OPTIONS.map(area => {
                  const selected = painAreas.includes(area)
                  return (
                    <button
                      key={area}
                      onClick={() => togglePain(area)}
                      className={`px-5 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-95 ${
                        selected
                          ? 'bg-coach-700 border-coach-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {area}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setStep(4)}
                className="w-full py-3.5 rounded-2xl bg-coach-600 hover:bg-coach-500 active:scale-95 text-white font-semibold text-sm transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white leading-snug">
                  Anything else the coach should know?
                </h2>
                <p className="text-sm text-zinc-500 mt-1">Optional</p>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. legs feel heavy from yesterday's workout"
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-coach-600 resize-none"
              />
              <button
                onClick={submit}
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-coach-600 hover:bg-coach-500 active:scale-95 disabled:opacity-60 text-white font-semibold text-sm transition-all"
              >
                {saving ? 'Saving…' : isUpdate ? 'Update Check-in' : 'Submit Check-in'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RatingStep({
  question,
  value,
  labels,
  onSelect,
}: {
  question: string
  value: number | null
  labels: string[]
  onSelect: (v: number) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white leading-snug">{question}</h2>
        <p className="text-sm font-medium text-coach-400 mt-1 h-5">
          {value !== null ? labels[value] : ''}
        </p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            onClick={() => onSelect(v)}
            className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl border transition-all active:scale-95 ${
              value === v
                ? 'bg-coach-700 border-coach-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            <span className="text-2xl font-bold">{v}</span>
            <span className="text-[9px] leading-tight text-center px-1 font-medium opacity-80">
              {labels[v]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReadinessBadge({ status, wide }: { status: ReadinessStatus; wide?: boolean }) {
  const cfg = {
    green:  { label: 'Ready',    bg: 'bg-green-950/60',  border: 'border-green-800/50',  text: 'text-green-400',  dot: 'bg-green-400' },
    yellow: { label: 'Moderate', bg: 'bg-yellow-950/60', border: 'border-yellow-800/50', text: 'text-yellow-400', dot: 'bg-yellow-400' },
    red:    { label: 'Recovery', bg: 'bg-red-950/60',    border: 'border-red-800/50',    text: 'text-red-400',    dot: 'bg-red-400' },
  }[status]
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${wide ? 'w-full' : ''} ${cfg.bg} ${cfg.border}`}>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`font-semibold text-sm ${cfg.text}`}>
        Readiness: {cfg.label}
      </span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-medium text-zinc-500 w-14 flex-shrink-0">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  )
}
