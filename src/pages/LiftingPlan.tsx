import { useState, useEffect, useCallback } from 'react'
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
}

interface AiSuggestion {
  name: string
  equipment: string[]
  sets: number
  reps: string
  form_cues: string[]
  common_mistakes: string[]
  running_benefit: string
  ai_reasoning: string
}

interface ModalState {
  ex: DbExercise | AiSuggestion
  isPreview: boolean
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

  const [aiPreview, setAiPreview] = useState<AiSuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Fetch coaching snap for readiness + hasLiftedToday
  useEffect(() => {
    fetch('/api/coaching-message')
      .then(r => (r.ok ? (r.json() as Promise<{ readiness: ReadinessStatus | null; hasLiftedToday: boolean }>) : Promise.reject()))
      .then(d => setCoaching({ readiness: d.readiness, hasLiftedToday: d.hasLiftedToday }))
      .catch(() => setCoaching(null))
      .finally(() => setCoachingLoading(false))
  }, [])

  const dayType = resolvedDayType(dow, coaching?.readiness ?? null)

  const loadExercises = useCallback(async (dt: string) => {
    if (dt === 'rest') {
      setExercises([])
      return
    }
    setExercisesLoading(true)
    const { data } = await supabase
      .from('exercises')
      .select('id, name, equipment, sets, reps, form_cues, common_mistakes, running_benefit, youtube_url, notes, is_ai_suggested, ai_reasoning')
      .eq('day_type', dt)
      .order('is_ai_suggested', { ascending: true })
      .order('sort_order', { ascending: true })
    setExercises((data as DbExercise[]) ?? [])
    setExercisesLoading(false)
  }, [])

  useEffect(() => {
    if (!coachingLoading) void loadExercises(dayType)
  }, [coachingLoading, dayType, loadExercises])

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

      ctx.push(`Current ${dayType} exercises already in plan: ${exercises.map(e => e.name).join(', ')}`)

      const res = await fetch('/api/exercises/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_type: dayType,
          athlete_context: ctx.join('\n'),
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
        day_type: dayType,
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
      await loadExercises(dayType)
    } catch (err) {
      setAiError((err as Error).message)
    } finally {
      setAiSaving(false)
    }
  }

  const isRest = dayType === 'rest'
  const isLoading = coachingLoading || exercisesLoading
  const hasLiftedToday = coaching?.hasLiftedToday ?? false
  const readiness = coaching?.readiness ?? null
  const dayContext = buildDayContext(dow, dayType, readiness)

  return (
    <div className="px-4 pt-6 pb-6 space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {DAY_TYPE_DISPLAY[dayType] ?? 'Lifting Plan'}
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">{dayContext}</p>
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
      {!isLoading && !isRest && exercises.length === 0 && aiPreview.length === 0 && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500">No exercises found for today's session</p>
        </div>
      )}

      {/* Exercise list */}
      {!isLoading && !isRest && (
        <div className="space-y-2.5">

          {/* DB exercises */}
          {exercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              name={ex.name}
              equipment={ex.equipment}
              sets={ex.sets}
              reps={ex.reps}
              isAi={ex.is_ai_suggested}
              aiReasoning={ex.ai_reasoning}
              onTap={() => openModal(ex, false)}
            />
          ))}

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

              {/* Sets × Reps */}
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

              {/* YouTube demo button */}
              {'youtube_url' in modal.ex && modal.ex.youtube_url && (
                <a
                  href={modal.ex.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-red-600/10 border border-red-600/30 text-sm font-semibold text-red-400 active:bg-red-600/20 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55a3.02 3.02 0 00-2.12 2.14C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
                  </svg>
                  Watch Demo
                </a>
              )}

            </div>
          </div>
        </>
      )}

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
  onTap,
}: {
  name: string
  equipment: string[]
  sets: number
  reps: string
  isAi: boolean
  aiReasoning?: string | null
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
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <span className="text-sm font-bold text-coach-400 tabular-nums whitespace-nowrap">
            {sets}×{reps}
          </span>
          <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </button>
  )
}
