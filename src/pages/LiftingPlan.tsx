import { useState, useEffect, useCallback, useReducer } from 'react'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReadinessStatus = 'green' | 'yellow' | 'red'

interface CoachingSnap {
  readiness: ReadinessStatus | null
  hasLiftedToday: boolean
}

interface DbExercise {
  id: string
  name: string
  equipment: string[]
  sets: number
  reps: string
  form_cues: string[]
  common_mistakes: string[]
  running_benefit: string
  youtube_url: string | null
  notes: string | null
  is_ai_suggested: boolean
  ai_reasoning: string | null
  day_type: string
}

interface AiSuggestion {
  name: string
  equipment: string[]
  sets: number
  reps: string
  form_cues: string[]
  common_mistakes: string[]
  running_benefit: string
  youtube_url?: string | null
  ai_reasoning: string
}

interface ModalState {
  ex: DbExercise | AiSuggestion
  isPreview: boolean
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

const isTimeBased = (reps: string): boolean => {
  const l = reps.toLowerCase()
  return l.includes('second') || l.includes('minute') || l.includes('sec') || l.includes('min')
}

const parseDuration = (reps: string): number => {
  const rangeMatch = reps.match(/(\d+)-(\d+)/)
  if (rangeMatch) return Math.round((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2)
  const minuteMatch = reps.match(/(\d+)\s*min/i)
  if (minuteMatch) return parseInt(minuteMatch[1]) * 60
  const secondMatch = reps.match(/(\d+)\s*sec/i)
  if (secondMatch) return parseInt(secondMatch[1])
  return 30
}

function playBeep() {
  try {
    type WinWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }
    const AudioCtx = window.AudioContext ?? (window as WinWithWebkit).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch { /* AudioContext unavailable */ }
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

function getYoutubeUrl(name: string, youtubeUrl: string | null | undefined): string {
  if (youtubeUrl) return youtubeUrl
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' proper form for runners')}`
}

function getYoutubeThumbnail(youtubeUrl: string | null | undefined): string | null {
  if (!youtubeUrl) return null
  const match = youtubeUrl.match(/[?&]v=([^&#]+)/)
  if (!match) return null
  return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BASE_DAY_TYPE: Record<number, string> = {
  0: 'lower_b',   // Sunday
  1: 'lower_a',   // Monday
  2: 'upper',     // Tuesday — team practice
  3: 'upper',     // Wednesday
  4: 'upper',     // Thursday — team practice
  5: 'mobility',  // Friday
  6: 'rest',      // Saturday — team practice
}

const DAY_TYPE_DISPLAY: Record<string, string> = {
  lower_a: 'Lower Body A',
  lower_b: 'Lower Body B',
  upper: 'Upper Body + Core',
  mobility: 'Recovery & Mobility',
  rest: 'Rest Day',
}

const DAY_TYPE_CONTEXT: Record<string, string> = {
  lower_a: 'Heavy Lower Body',
  lower_b: 'Lower Body B',
  upper: 'Upper Body + Core',
  mobility: 'Recovery & Mobility',
  rest: 'Rest Day',
}

const PRACTICE_DAYS = new Set([2, 4, 6])

const SELECTOR_OPTIONS = [
  { label: 'Lower A',  value: 'lower_a' },
  { label: 'Lower B',  value: 'lower_b' },
  { label: 'Upper',    value: 'upper' },
  { label: 'Mobility', value: 'mobility' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolvedDayType(dow: number, readiness: ReadinessStatus | null): string {
  const base = BASE_DAY_TYPE[dow] ?? 'upper'
  if (readiness === 'red') return 'mobility'
  if (readiness === 'yellow' && (base === 'lower_a' || base === 'lower_b')) return 'upper'
  return base
}

function buildDayContext(dow: number, dayType: string, readiness: ReadinessStatus | null): string {
  const base = BASE_DAY_TYPE[dow] ?? 'upper'
  const dayName = DAY_NAMES[dow]
  const practice = PRACTICE_DAYS.has(dow) ? ' · Practice Day' : ''
  const context = DAY_TYPE_CONTEXT[dayType] ?? dayType

  if (readiness === 'red' && dayType !== base) {
    return `${dayName}${practice} · Recovery Override`
  }
  if (readiness === 'yellow' && dayType !== base) {
    return `${dayName}${practice} · Intensity Reduced`
  }
  return `${dayName}${practice} · ${context}`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiftingPlan() {
  const dow = new Date().getDay()

  const [coaching, setCoaching] = useState<CoachingSnap | null>(null)
  const [coachingLoading, setCoachingLoading] = useState(true)

  const [exercises, setExercises] = useState<DbExercise[]>([])
  const [exercisesLoading, setExercisesLoading] = useState(false)

  const [modal, setModal] = useState<ModalState | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [thumbError, setThumbError] = useState(false)

  useEffect(() => setThumbError(false), [modal?.ex.name])

  const [aiPreview, setAiPreview] = useState<AiSuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackSuggestion, setFeedbackSuggestion] = useState<AiSuggestion[] | null>(null)
  const [appliedFeedbackWorkout, setAppliedFeedbackWorkout] = useState<AiSuggestion[] | null>(null)

  // Fetch coaching snap for readiness + hasLiftedToday
  useEffect(() => {
    fetch('/api/coaching-message')
      .then(r => (r.ok ? (r.json() as Promise<{ readiness: ReadinessStatus | null; hasLiftedToday: boolean }>) : Promise.reject()))
      .then(d => setCoaching({ readiness: d.readiness, hasLiftedToday: d.hasLiftedToday }))
      .catch(() => setCoaching(null))
      .finally(() => setCoachingLoading(false))
  }, [])

  const coachDayType = (() => {
    const r = resolvedDayType(dow, coaching?.readiness ?? null)
    return r === 'rest' ? 'lower_a' : r
  })()

  const [selectedDayType, setSelectedDayType] = useState<string | null>(null)

  // Lock in the coach pick once coaching resolves; don't overwrite a manual selection
  useEffect(() => {
    if (!coachingLoading && selectedDayType === null) {
      setSelectedDayType(coachDayType)
    }
  }, [coachingLoading, coachDayType, selectedDayType])

  // Clear AI state when the user switches day type
  useEffect(() => {
    if (selectedDayType !== null) {
      setAiPreview([])
      setAiError(null)
      setFeedbackSuggestion(null)
      setAppliedFeedbackWorkout(null)
    }
  }, [selectedDayType])

  const activeDayType = selectedDayType ?? coachDayType
  const isCustom = activeDayType !== coachDayType

  const loadExercises = useCallback(async () => {
    setExercisesLoading(true)
    const { data } = await supabase
      .from('exercises')
      .select('id, name, equipment, sets, reps, form_cues, common_mistakes, running_benefit, youtube_url, notes, is_ai_suggested, ai_reasoning, day_type')
      .in('day_type', ['lower_a', 'lower_b', 'upper', 'mobility'])
      .order('is_ai_suggested', { ascending: true })
      .order('sort_order', { ascending: true })
    setExercises((data as DbExercise[]) ?? [])
    setExercisesLoading(false)
  }, [])

  useEffect(() => {
    if (!coachingLoading) void loadExercises()
  }, [coachingLoading, loadExercises])

  // Modal
  function openModal(ex: DbExercise | AiSuggestion, isPreview: boolean) {
    setModal({ ex, isPreview })
    setTimeout(() => setModalVisible(true), 10)
  }

  function closeModal() {
    setModalVisible(false)
    setTimeout(() => setModal(null), 300)
  }

  // AI suggestions
  async function requestAiSuggestions() {
    setAiLoading(true)
    setAiError(null)
    setAiPreview([])

    try {
      const [athleteRes, activitiesRes] = await Promise.all([
        supabase
          .from('athlete')
          .select('injury_history, focus_areas, gym_equipment, exercises_to_avoid')
          .maybeSingle(),
        supabase
          .from('activities')
          .select('name, sport_type, distance_meters, effort_level')
          .order('start_date', { ascending: false })
          .limit(3),
      ])

      const ctx: string[] = [
        `Readiness: ${coaching?.readiness ?? 'unknown'}`,
        `Has lifted today: ${coaching?.hasLiftedToday ? 'yes' : 'no'}`,
      ]

      const athlete = athleteRes.data
      if (athlete?.injury_history) ctx.push(`Injury history: ${athlete.injury_history}`)
      if (athlete?.focus_areas?.length) ctx.push(`Focus areas: ${athlete.focus_areas.join(', ')}`)
      if (athlete?.gym_equipment?.length) ctx.push(`Available equipment: ${athlete.gym_equipment.join(', ')}`)
      if (athlete?.exercises_to_avoid) ctx.push(`Exercises to avoid: ${athlete.exercises_to_avoid}`)

      const acts = activitiesRes.data ?? []
      if (acts.length) {
        const lines = acts.map(a => {
          const mi = a.distance_meters ? `${(a.distance_meters / 1609.34).toFixed(1)} mi` : ''
          return `${a.name} (${a.sport_type}${mi ? ', ' + mi : ''}, effort: ${a.effort_level ?? '—'})`
        })
        ctx.push(`Recent activities: ${lines.join('; ')}`)
      }

      const currentExerciseNames = activeExercises.map(e => e.name)

      const res = await fetch('/api/exercises/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_type: activeDayType,
          athlete_context: ctx.join('\n'),
          current_exercises: currentExerciseNames,
          save: false,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAiPreview((await res.json()) as AiSuggestion[])
    } catch (err) {
      setAiError((err as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  // Save previewed suggestions directly — what you see is what gets saved
  async function saveAiSuggestions() {
    if (!aiPreview.length) return
    setAiSaving(true)
    setAiError(null)

    try {
      const rows = aiPreview.map((ex, i) => ({
        name: ex.name,
        equipment: ex.equipment ?? [],
        day_type: activeDayType,
        sort_order: 100 + i,
        sets: ex.sets,
        reps: ex.reps,
        form_cues: ex.form_cues ?? [],
        common_mistakes: ex.common_mistakes ?? [],
        running_benefit: ex.running_benefit,
        is_ai_suggested: true,
        ai_reasoning: ex.ai_reasoning ?? null,
      }))

      const { error } = await supabase.from('exercises').insert(rows)
      if (error) throw error

      setAiPreview([])
      await loadExercises()
    } catch (err) {
      setAiError((err as Error).message)
    } finally {
      setAiSaving(false)
    }
  }

  async function submitFeedback() {
    const text = feedbackText.trim()
    if (!text) return
    setFeedbackLoading(true)
    setFeedbackError(null)
    setFeedbackSuggestion(null)

    try {
      const ctx: string[] = [
        `User feedback: ${text}`,
        `Coach recommended day type: ${coachDayType}`,
        `Selected day type: ${activeDayType}`,
        `Is custom selection: ${isCustom ? 'yes' : 'no'}`,
        `Readiness: ${coaching?.readiness ?? 'unknown'}`,
        `Has lifted today: ${coaching?.hasLiftedToday ? 'yes' : 'no'}`,
      ]

      const res = await fetch('/api/exercises/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_type: activeDayType,
          athlete_context: ctx.join('\n'),
          current_exercises: displayedExercises.map(e => e.name),
          save: false,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setFeedbackSuggestion((await res.json()) as AiSuggestion[])
      setFeedbackText('')
    } catch (err) {
      setFeedbackError((err as Error).message)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const isRest = false
  const isLoading = coachingLoading || exercisesLoading
  const hasLiftedToday = coaching?.hasLiftedToday ?? false
  const readiness = coaching?.readiness ?? null
  const dayContext = buildDayContext(dow, activeDayType, readiness)
  const displayedExercises = exercises.filter(e => e.day_type === activeDayType)
  const activeExercises = appliedFeedbackWorkout ?? displayedExercises
  const isAiAdjusted = appliedFeedbackWorkout !== null

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {DAY_TYPE_DISPLAY[activeDayType] ?? 'Lifting Plan'}
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">{dayContext}</p>
      </div>

      {/* Day type selector */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {SELECTOR_OPTIONS.map(opt => {
            const isActive = activeDayType === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setSelectedDayType(opt.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#1E6B3C] text-white border border-[#1E6B3C]'
                    : 'text-zinc-400 border border-zinc-700 active:bg-zinc-800'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5">
          {isAiAdjusted ? (
            <span className="text-[11px] font-semibold text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/60 tracking-wide">
              Custom (AI-adjusted)
            </span>
          ) : isCustom ? (
            <span className="text-[11px] font-semibold text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/60 tracking-wide">
              Custom
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-[#2d9a57] px-2 py-0.5 rounded-full border border-[#1E6B3C]/50 bg-[#1E6B3C]/10 tracking-wide">
              Coach pick
            </span>
          )}
        </div>
      </div>

      {/* Feedback panel */}
      <div>
        {!feedbackOpen ? (
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 active:text-zinc-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Adjust workout
          </button>
        ) : (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tell the coach</p>
              <button
                onClick={() => setFeedbackOpen(false)}
                className="text-zinc-600 active:text-zinc-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <textarea
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              rows={2}
              placeholder="e.g. 'knees are sore' or 'focus on glutes today'"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-coach-600"
            />
            {feedbackError && (
              <p className="text-xs text-red-400">{feedbackError}</p>
            )}
            <button
              onClick={() => void submitFeedback()}
              disabled={feedbackLoading || !feedbackText.trim()}
              className="w-full py-3 rounded-xl bg-[#1E6B3C] border border-[#1E6B3C] text-sm font-semibold text-white disabled:opacity-40 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {feedbackLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Thinking...
                </>
              ) : 'Get Adjusted Workout'}
            </button>
          </div>
        )}
      </div>

      {/* Status banners */}
      {hasLiftedToday && (
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 bg-green-950/60 border border-green-800/40">
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-400">Lift completed today</p>
        </div>
      )}

      {readiness === 'red' && (
        <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 bg-amber-950/60 border border-amber-800/40">
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm font-medium text-amber-400">Recovery day — mobility only</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-4 h-4 border-2 border-coach-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-zinc-500 italic">Loading today's session…</p>
        </div>
      )}

      {/* Rest day */}
      {!isLoading && isRest && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-8 text-center">
          <p className="text-base font-semibold text-white">Rest Day</p>
          <p className="text-sm text-zinc-500 mt-1.5">No lifting today — let your body recover</p>
        </div>
      )}

      {/* No exercises found */}
      {!isLoading && !isRest && activeExercises.length === 0 && aiPreview.length === 0 && !feedbackSuggestion && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500">No exercises found for today's session</p>
        </div>
      )}

      {/* Feedback suggestion card */}
      {!isLoading && feedbackSuggestion && (
        <div className="rounded-2xl bg-green-950/30 border border-green-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coach-900 border border-coach-700 text-coach-400 uppercase tracking-wide">
                AI Suggestion
              </span>
              <p className="text-xs text-zinc-500">Based on your feedback</p>
            </div>
            <button
              onClick={() => setFeedbackSuggestion(null)}
              className="text-zinc-600 active:text-zinc-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-0">
            {feedbackSuggestion.map((ex, i) => (
              <div key={i} className={`flex items-start justify-between gap-3 py-2.5 ${i < feedbackSuggestion.length - 1 ? 'border-b border-green-900/40' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{ex.name}</p>
                  {ex.ai_reasoning && (
                    <p className="text-xs text-zinc-500 italic leading-snug line-clamp-1 mt-0.5">{ex.ai_reasoning}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-coach-400 tabular-nums whitespace-nowrap flex-shrink-0 mt-0.5">
                  {ex.sets}×{ex.reps}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setAppliedFeedbackWorkout(feedbackSuggestion)
                setFeedbackSuggestion(null)
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#1E6B3C] border border-[#1E6B3C] text-sm font-semibold text-white active:scale-[0.98] transition-transform"
            >
              Apply This Workout
            </button>
            <button
              onClick={() => setFeedbackSuggestion(null)}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-400 active:bg-zinc-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Exercise list */}
      {!isLoading && !isRest && (
        <div className="space-y-2.5">

          {/* Exercises (DB or AI-applied) */}
          {activeExercises.map((ex, i) => {
            const isDb = 'id' in ex
            return (
              <ExerciseCard
                key={isDb ? ex.id : `applied-${i}`}
                name={ex.name}
                equipment={ex.equipment}
                sets={ex.sets}
                reps={ex.reps}
                isAi={isDb ? ex.is_ai_suggested : true}
                aiReasoning={ex.ai_reasoning}
                youtubeUrl={isDb ? ex.youtube_url : (ex as AiSuggestion).youtube_url ?? null}
                onTap={() => openModal(ex, !isDb)}
              />
            )
          })}

          {/* AI preview section */}
          {aiPreview.length > 0 && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  AI Suggestions
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {aiPreview.map((ex, i) => (
                <ExerciseCard
                  key={`ai-preview-${i}`}
                  name={ex.name}
                  equipment={ex.equipment}
                  sets={ex.sets}
                  reps={ex.reps}
                  isAi={true}
                  aiReasoning={ex.ai_reasoning}
                  onTap={() => openModal(ex, true)}
                />
              ))}

              <button
                onClick={() => void saveAiSuggestions()}
                disabled={aiSaving}
                className="w-full py-3.5 rounded-2xl bg-coach-700 border border-coach-600 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {aiSaving ? 'Saving…' : 'Save to My Plan'}
              </button>
            </>
          )}

          {/* Error */}
          {aiError && (
            <p className="text-xs text-red-400 text-center px-2 py-1">{aiError}</p>
          )}

          {/* AI suggestions button — hidden while previewing */}
          {aiPreview.length === 0 && (
            <button
              onClick={() => void requestAiSuggestions()}
              disabled={aiLoading}
              className="w-full py-3.5 rounded-2xl border border-coach-700/50 text-sm font-medium text-coach-400 flex items-center justify-center gap-2 disabled:opacity-50 active:bg-coach-950/40 transition-colors"
            >
              {aiLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-coach-400 border-t-transparent rounded-full animate-spin" />
                  Coach is thinking…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Get AI Exercise Suggestions
                </>
              )}
            </button>
          )}

        </div>
      )}

      {/* Exercise detail modal */}
      {modal && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeModal}
          />
          <div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm bg-zinc-900 border-t border-x border-zinc-800 rounded-t-3xl transition-transform duration-300 ${modalVisible ? 'translate-y-0' : 'translate-y-full'}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>

            <div className="px-5 pb-10 overflow-y-auto max-h-[82vh]">

              {/* Name + close */}
              <div className="flex items-start justify-between gap-3 pt-3 pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-white leading-tight">{modal.ex.name}</h2>
                    {(('is_ai_suggested' in modal.ex && modal.ex.is_ai_suggested) || modal.isPreview) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coach-900 border border-coach-700 text-coach-400 uppercase tracking-wide flex-shrink-0">
                        AI Pick
                      </span>
                    )}
                  </div>
                  {modal.ex.equipment.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {modal.ex.equipment.map((eq, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {eq}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={closeModal} className="p-1.5 text-zinc-500 hover:text-zinc-300 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sets × Reps — or timer for time-based exercises */}
              {isTimeBased(modal.ex.reps) ? (
                <ExerciseTimer key={modal.ex.name} sets={modal.ex.sets} reps={modal.ex.reps} />
              ) : (
                <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700/40 p-5 flex items-center justify-center gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white tabular-nums">{modal.ex.sets}</p>
                    <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Sets</p>
                  </div>
                  <p className="text-2xl text-zinc-600 font-light">×</p>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-coach-400 tabular-nums">{modal.ex.reps}</p>
                    <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Reps</p>
                  </div>
                </div>
              )}

              {/* AI reasoning */}
              {'ai_reasoning' in modal.ex && modal.ex.ai_reasoning && (
                <p className="text-xs text-coach-400/80 italic mb-4 px-0.5 leading-relaxed">
                  {modal.ex.ai_reasoning}
                </p>
              )}

              {/* Form cues */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Form Cues
                </p>
                <ol className="space-y-2.5">
                  {modal.ex.form_cues.map((cue, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-xs font-bold text-coach-500 w-4 flex-shrink-0 mt-0.5 tabular-nums">
                        {i + 1}.
                      </span>
                      <p className="text-sm text-zinc-300 leading-snug">{cue}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Common mistakes */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Common Mistakes
                </p>
                <ul className="space-y-2.5">
                  {modal.ex.common_mistakes.map((m, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-sm text-zinc-300 leading-snug">{m}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Running benefit */}
              <div className="rounded-xl bg-green-950/40 border border-green-800/30 px-4 py-3.5 flex items-start gap-3 mb-4">
                <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1">
                    Why This Helps Your Running
                  </p>
                  <p className="text-sm text-zinc-300 leading-snug">{modal.ex.running_benefit}</p>
                </div>
              </div>

              {/* YouTube thumbnail + demo button */}
              {(() => {
                const storedUrl = 'youtube_url' in modal.ex ? modal.ex.youtube_url : null
                const demoUrl = getYoutubeUrl(modal.ex.name, storedUrl)
                const thumbnail = getYoutubeThumbnail(storedUrl)
                return (
                  <div className="space-y-3">
                    {/* Thumbnail — only shown when a direct URL exists and hasn't errored */}
                    {thumbnail && !thumbError && (
                      <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden">
                        <img
                          src={thumbnail}
                          alt={`${modal.ex.name} demo`}
                          className="w-full object-cover aspect-video bg-zinc-800"
                          onError={() => setThumbError(true)}
                        />
                      </a>
                    )}

                    {/* Button */}
                    <a
                      href={demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative overflow-hidden flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl border border-blue-500/40 text-sm font-semibold text-blue-300 active:opacity-80 transition-opacity"
                      style={{
                        background: 'linear-gradient(105deg, #1e3a5f 0%, #1d4ed8 40%, #60a5fa 50%, #1d4ed8 60%, #1e3a5f 100%)',
                        backgroundSize: '300% auto',
                        animation: 'shimmer 2.4s linear infinite',
                      }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55a3.02 3.02 0 00-2.12 2.14C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
                      </svg>
                      {storedUrl ? 'Watch Demo' : 'Search Demo on YouTube'}
                    </a>
                  </div>
                )
              })()}

            </div>
          </div>
        </>
      )}

    </div>
  )
}

// ─── Exercise Timer ───────────────────────────────────────────────────────────

const REST_SECONDS = 15
const TIMER_RADIUS = 54
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS

type TimerPhase = 'work' | 'rest' | 'complete'

type TimerState = {
  totalSeconds: number
  remainingSeconds: number
  isRunning: boolean
  currentSet: number
  totalSets: number
  phase: TimerPhase
  side: 'left' | 'right' | null
  flash: boolean
}

type TimerAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'TICK' }
  | { type: 'CLEAR_FLASH' }
  | { type: 'ADJUST_TIME'; delta: number }

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'START':      return { ...state, isRunning: true }
    case 'PAUSE':      return { ...state, isRunning: false }
    case 'CLEAR_FLASH': return { ...state, flash: false }
    case 'ADJUST_TIME': {
      const newRemaining = Math.max(5, state.remainingSeconds + action.delta)
      const newTotal = Math.max(5, state.totalSeconds + action.delta)
      return { ...state, remainingSeconds: newRemaining, totalSeconds: newTotal }
    }
    case 'RESET':
      return {
        ...state,
        remainingSeconds: state.totalSeconds,
        isRunning: false,
        currentSet: 1,
        phase: 'work',
        side: state.side != null ? 'left' : null,
        flash: false,
      }
    case 'TICK': {
      if (!state.isRunning || state.phase === 'complete') return state
      const next = state.remainingSeconds - 1
      if (next > 0) return { ...state, remainingSeconds: next }

      // Reached zero
      if (state.phase === 'work') {
        // Mid-set: switch to right side (no rest between sides)
        if (state.side === 'left') {
          return { ...state, remainingSeconds: state.totalSeconds, side: 'right', flash: true }
        }
        // Last set done
        if (state.currentSet >= state.totalSets) {
          return { ...state, remainingSeconds: 0, isRunning: false, phase: 'complete', flash: true }
        }
        // More sets: start rest
        return { ...state, remainingSeconds: REST_SECONDS, phase: 'rest', flash: true }
      }

      if (state.phase === 'rest') {
        // Rest done: start next set (no beep)
        return {
          ...state,
          remainingSeconds: state.totalSeconds,
          phase: 'work',
          currentSet: state.currentSet + 1,
          side: state.side != null ? 'left' : null,
          flash: false,
        }
      }

      return state
    }
    default: return state
  }
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function ExerciseTimer({ sets, reps }: { sets: number; reps: string }) {
  const totalSeconds = parseDuration(reps)
  const eachSide = reps.toLowerCase().includes('each side') || reps.toLowerCase().includes('each leg')

  const [state, dispatch] = useReducer(timerReducer, {
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning: false,
    currentSet: 1,
    totalSets: sets,
    phase: 'work',
    side: eachSide ? 'left' : null,
    flash: false,
  })

  // Tick interval
  useEffect(() => {
    if (!state.isRunning) return
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(id)
  }, [state.isRunning])

  // Beep + vibrate on flash
  useEffect(() => {
    if (!state.flash) return
    playBeep()
    navigator.vibrate?.(200)
    const id = setTimeout(() => dispatch({ type: 'CLEAR_FLASH' }), 600)
    return () => clearTimeout(id)
  }, [state.flash])

  const displayTotal = state.phase === 'rest' ? REST_SECONDS : state.totalSeconds
  const progress = displayTotal > 0 ? state.remainingSeconds / displayTotal : 0
  const strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - progress)
  const ringColor = state.phase === 'rest' ? '#f59e0b' : '#2d9a57'

  if (state.phase === 'complete') {
    return (
      <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700/40 p-5 text-center mb-4">
        <p className="text-3xl mb-1">🎉</p>
        <p className="text-lg font-bold text-white mb-1">Complete!</p>
        <p className="text-sm text-zinc-400">{sets} sets × {reps}</p>
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="mt-4 px-5 py-2.5 rounded-xl bg-zinc-700 border border-zinc-600 text-sm font-semibold text-zinc-300 active:scale-95 transition-transform"
        >
          Reset
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 mb-4 transition-colors duration-300 ${
      state.flash ? 'bg-green-950/60 border-green-700/50' : 'bg-zinc-800/50 border-zinc-700/40'
    }`}>
      {/* Progress ring with flanking ±5s buttons */}
      <div className="flex items-center justify-center gap-3 mb-3">
        {/* −5s */}
        <button
          onClick={() => dispatch({ type: 'ADJUST_TIME', delta: -5 })}
          className="w-11 h-11 rounded-full border border-coach-700/60 bg-coach-950/60 text-coach-400 text-xs font-bold active:scale-95 transition-transform flex items-center justify-center"
        >
          −5s
        </button>

        {/* Ring */}
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={TIMER_RADIUS} fill="none" stroke="#27272a" strokeWidth="8" />
            <circle
              cx="70" cy="70" r={TIMER_RADIUS}
              fill="none" stroke={ringColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={TIMER_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 70 70)"
              style={{ transition: state.isRunning ? 'stroke-dashoffset 1s linear' : 'none' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {state.phase === 'rest' && (
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-0.5">Rest</p>
            )}
            <p className="text-3xl font-bold text-white tabular-nums leading-none">
              {fmtTime(state.remainingSeconds)}
            </p>
          </div>
        </div>

        {/* +5s */}
        <button
          onClick={() => dispatch({ type: 'ADJUST_TIME', delta: 5 })}
          className="w-11 h-11 rounded-full border border-coach-700/60 bg-coach-950/60 text-coach-400 text-xs font-bold active:scale-95 transition-transform flex items-center justify-center"
        >
          +5s
        </button>
      </div>

      {/* Set + side label */}
      <p className="text-sm font-medium text-zinc-400 text-center mb-4">
        Set {state.currentSet} of {state.totalSets}
        {state.side ? ` · ${state.side === 'left' ? 'Left Side' : 'Right Side'}` : ''}
        {state.phase === 'rest' ? ' · Rest' : ''}
      </p>

      {/* Controls */}
      <div className="flex gap-2">
        {!state.isRunning ? (
          <button
            onClick={() => dispatch({ type: 'START' })}
            className="flex-1 py-3 rounded-xl bg-green-800 border border-green-600/60 text-sm font-bold text-white active:scale-95 transition-transform"
          >
            Start
          </button>
        ) : (
          <button
            onClick={() => dispatch({ type: 'PAUSE' })}
            className="flex-1 py-3 rounded-xl bg-amber-800/80 border border-amber-600/60 text-sm font-bold text-white active:scale-95 transition-transform"
          >
            Pause
          </button>
        )}
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="px-5 py-3 rounded-xl bg-zinc-700 border border-zinc-600 text-sm font-bold text-zinc-300 active:scale-95 transition-transform"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  name,
  equipment,
  sets,
  reps,
  isAi,
  aiReasoning,
  youtubeUrl,
  onTap,
}: {
  name: string
  equipment: string[]
  sets: number
  reps: string
  isAi: boolean
  aiReasoning?: string | null
  youtubeUrl?: string | null
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3.5 active:bg-zinc-800/70 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-white">{name}</span>
            {isAi && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-coach-900 border border-coach-700/80 text-coach-400 uppercase tracking-wide flex-shrink-0">
                AI Pick
              </span>
            )}
          </div>
          {aiReasoning && (
            <p className="text-xs text-zinc-500 italic leading-snug line-clamp-2 mb-1.5">
              {aiReasoning}
            </p>
          )}
          {equipment.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {equipment.map((eq, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/60">
                  {eq}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <span className="text-sm font-bold text-coach-400 tabular-nums whitespace-nowrap">
            {sets}×{reps}
          </span>
          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${youtubeUrl ? 'text-blue-500/70' : 'text-zinc-600'}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55a3.02 3.02 0 00-2.12 2.14C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
          </svg>
          <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </button>
  )
}
