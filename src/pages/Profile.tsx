import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsToMmSs(totalSeconds: number | null): [string, string] {
  if (totalSeconds == null) return ['', '']
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return [String(m), String(s).padStart(2, '0')]
}

function mmSsToSeconds(mins: string, secs: string): number | null {
  const m = parseInt(mins, 10)
  const s = parseInt(secs, 10)
  if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s > 59) return null
  return m * 60 + s
}

function nullableInt(val: string): number | null {
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function nullableFloat(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_EQUIPMENT = [
  'Barbells', 'Dumbbells', 'Kettlebells', 'TRX',
  'Cable Machine', 'Leg Press', 'Pull-up Bar', 'Resistance Bands',
]

const FOCUS_OPTS = [
  'Base Building', 'Speed Work', 'Tempo', 'Hill Work', 'Race Fitness', 'Recovery',
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-coach-400 uppercase tracking-widest">{title}</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-5">
        {subtitle && (
          <p className="text-xs text-zinc-500 leading-relaxed -mt-1">{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-zinc-300 mb-2">{children}</label>
}

function HelperText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{children}</p>
}

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all active:scale-95 ${
        selected
          ? 'bg-coach-700 border-coach-500 text-white'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  )
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-95 ${
            value === opt
              ? 'bg-coach-700 border-coach-500 text-white'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
          }`}
        >
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  )
}

function PrField({
  label,
  minVal,
  secVal,
  minPlaceholder,
  secPlaceholder,
  onMinChange,
  onSecChange,
}: {
  label: string
  minVal: string
  secVal: string
  minPlaceholder: string
  secPlaceholder: string
  onMinChange: (v: string) => void
  onSecChange: (v: string) => void
}) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-3">
      <p className="text-xs font-medium text-zinc-400 mb-2">{label}</p>
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            placeholder={minPlaceholder}
            value={minVal}
            onChange={e => onMinChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-sm text-center placeholder-zinc-600 focus:outline-none focus:border-coach-600"
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 pointer-events-none">m</span>
        </div>
        <span className="text-zinc-600 font-bold text-sm select-none">:</span>
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            max="59"
            placeholder={secPlaceholder}
            value={secVal}
            onChange={e => onSecChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-sm text-center placeholder-zinc-600 focus:outline-none focus:border-coach-600"
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 pointer-events-none">s</span>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-coach-600'

const textareaCls = inputCls + ' resize-none'

// ─── Form state type ──────────────────────────────────────────────────────────

type ProfileForm = {
  // Running Goals
  currentPrMins: string
  currentPrSecs: string
  goalPrMins: string
  goalPrSecs: string
  season_start_date: string
  target_weekly_mileage: string
  current_weekly_mileage: string
  other_goals: string
  // Body & Performance Metrics
  height_ft: string
  height_in: string
  weight_lbs: string
  resting_hr: string
  max_hr: string
  vo2_max: string
  years_weight_training: number
  longest_run_miles: string
  highest_weekly_mileage: string
  // Personal Records
  pr400mMins: string
  pr400mSecs: string
  pr800mMins: string
  pr800mSecs: string
  pr1600mMins: string
  pr1600mSecs: string
  pr3200mMins: string
  pr3200mSecs: string
  pr5kMins: string
  pr5kSecs: string
  pr10kMins: string
  pr10kSecs: string
  // Training Setup
  team_practice_days: string[]
  years_running: string
  injury_history: string
  focus_areas: string[]
  // Lifting Preferences
  lifting_days_per_week: number
  exercises_to_avoid: string
  gym_equipment: string[]
  // Coach Preferences
  coach_message_style: string
  coach_motivation_style: string
  morning_reminder_time: string
  coach_notes: string
}

const DEFAULT_FORM: ProfileForm = {
  currentPrMins: '', currentPrSecs: '',
  goalPrMins: '', goalPrSecs: '',
  season_start_date: '',
  target_weekly_mileage: '50',
  current_weekly_mileage: '25',
  other_goals: '',
  height_ft: '', height_in: '',
  weight_lbs: '',
  resting_hr: '',
  max_hr: '',
  vo2_max: '',
  years_weight_training: 0,
  longest_run_miles: '',
  highest_weekly_mileage: '',
  pr400mMins: '', pr400mSecs: '',
  pr800mMins: '', pr800mSecs: '',
  pr1600mMins: '', pr1600mSecs: '',
  pr3200mMins: '', pr3200mSecs: '',
  pr5kMins: '', pr5kSecs: '',
  pr10kMins: '', pr10kSecs: '',
  team_practice_days: ['tuesday', 'thursday', 'saturday'],
  years_running: '',
  injury_history: '',
  focus_areas: [],
  lifting_days_per_week: 4,
  exercises_to_avoid: '',
  gym_equipment: [...ALL_EQUIPMENT],
  coach_message_style: 'balanced',
  coach_motivation_style: 'balanced',
  morning_reminder_time: '07:00',
  coach_notes: '',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const [form, setForm] = useState<ProfileForm>(DEFAULT_FORM)
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ currentPr?: string; goalPr?: string }>({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('athlete').select('*').maybeSingle()
      if (!data) { setLoading(false); return }

      const [cMins, cSecs] = secondsToMmSs(data.current_pr_seconds)
      const [gMins, gSecs] = secondsToMmSs(data.goal_pr_seconds)
      const [p400m, p400s] = secondsToMmSs(data.pr_400m_seconds)
      const [p800m, p800s] = secondsToMmSs(data.pr_800m_seconds)
      const [p1600m, p1600s] = secondsToMmSs(data.pr_1600m_seconds)
      const [p3200m, p3200s] = secondsToMmSs(data.pr_3200m_seconds)
      const [p5km, p5ks] = secondsToMmSs(data.pr_5k_seconds)
      const [p10km, p10ks] = secondsToMmSs(data.pr_10k_seconds)

      const hi = data.height_inches
      const heightFt = hi != null ? String(Math.floor(hi / 12)) : ''
      const heightIn = hi != null ? String(hi % 12) : ''

      setAthleteId(data.id)
      setForm({
        currentPrMins: cMins,
        currentPrSecs: cSecs,
        goalPrMins: gMins,
        goalPrSecs: gSecs,
        season_start_date: data.season_start_date ?? '',
        target_weekly_mileage: String(data.target_weekly_mileage ?? 50),
        current_weekly_mileage: String(data.current_weekly_mileage ?? 25),
        other_goals: data.other_goals ?? '',
        height_ft: heightFt,
        height_in: heightIn,
        weight_lbs: data.weight_lbs != null ? String(data.weight_lbs) : '',
        resting_hr: data.resting_hr != null ? String(data.resting_hr) : '',
        max_hr: data.max_hr != null ? String(data.max_hr) : '',
        vo2_max: data.vo2_max != null ? String(data.vo2_max) : '',
        years_weight_training: data.years_weight_training ?? 0,
        longest_run_miles: data.longest_run_miles != null ? String(data.longest_run_miles) : '',
        highest_weekly_mileage: data.highest_weekly_mileage != null ? String(data.highest_weekly_mileage) : '',
        pr400mMins: p400m, pr400mSecs: p400s,
        pr800mMins: p800m, pr800mSecs: p800s,
        pr1600mMins: p1600m, pr1600mSecs: p1600s,
        pr3200mMins: p3200m, pr3200mSecs: p3200s,
        pr5kMins: p5km, pr5kSecs: p5ks,
        pr10kMins: p10km, pr10kSecs: p10ks,
        team_practice_days: data.team_practice_days ?? ['tuesday', 'thursday', 'saturday'],
        years_running: data.years_running != null ? String(data.years_running) : '',
        injury_history: data.injury_history ?? '',
        focus_areas: data.focus_areas ?? [],
        lifting_days_per_week: data.lifting_days_per_week ?? 4,
        exercises_to_avoid: data.exercises_to_avoid ?? '',
        gym_equipment: data.gym_equipment ?? [...ALL_EQUIPMENT],
        coach_message_style: data.coach_message_style ?? 'balanced',
        coach_motivation_style: data.coach_motivation_style ?? 'balanced',
        morning_reminder_time: data.morning_reminder_time ?? '07:00',
        coach_notes: data.coach_notes ?? '',
      })
      setLoading(false)
    }
    void load()
  }, [])

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleArray(key: 'team_practice_days' | 'focus_areas' | 'gym_equipment', value: string) {
    setForm(prev => {
      const arr = prev[key] as string[]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      }
    })
  }

  async function save() {
    const newErrors: typeof errors = {}

    const currentPrSecs =
      form.currentPrMins || form.currentPrSecs
        ? mmSsToSeconds(form.currentPrMins, form.currentPrSecs)
        : null
    const goalPrSecs =
      form.goalPrMins || form.goalPrSecs
        ? mmSsToSeconds(form.goalPrMins, form.goalPrSecs)
        : null

    if ((form.currentPrMins || form.currentPrSecs) && currentPrSecs === null) {
      newErrors.currentPr = 'Enter a valid time (seconds must be 0–59)'
    }
    if ((form.goalPrMins || form.goalPrSecs) && goalPrSecs === null) {
      newErrors.goalPr = 'Enter a valid time (seconds must be 0–59)'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setSaving(true)

    // Height: only store if at least one part is filled
    const heightFtN = nullableInt(form.height_ft)
    const heightInN = nullableInt(form.height_in)
    const height_inches =
      heightFtN != null || heightInN != null
        ? (heightFtN ?? 0) * 12 + (heightInN ?? 0)
        : null

    // PR fields
    const pr400 = (form.pr400mMins || form.pr400mSecs) ? mmSsToSeconds(form.pr400mMins, form.pr400mSecs) : null
    const pr800 = (form.pr800mMins || form.pr800mSecs) ? mmSsToSeconds(form.pr800mMins, form.pr800mSecs) : null
    const pr1600 = (form.pr1600mMins || form.pr1600mSecs) ? mmSsToSeconds(form.pr1600mMins, form.pr1600mSecs) : null
    const pr3200 = (form.pr3200mMins || form.pr3200mSecs) ? mmSsToSeconds(form.pr3200mMins, form.pr3200mSecs) : null
    const pr5k = (form.pr5kMins || form.pr5kSecs) ? mmSsToSeconds(form.pr5kMins, form.pr5kSecs) : null
    const pr10k = (form.pr10kMins || form.pr10kSecs) ? mmSsToSeconds(form.pr10kMins, form.pr10kSecs) : null

    const payload = {
      // Running Goals
      current_pr_seconds: pr5k ?? currentPrSecs,
      goal_pr_seconds: goalPrSecs,
      season_start_date: form.season_start_date || null,
      target_weekly_mileage: parseInt(form.target_weekly_mileage, 10) || 50,
      current_weekly_mileage: parseInt(form.current_weekly_mileage, 10) || 25,
      other_goals: form.other_goals.trim() || null,
      // Body & Performance Metrics
      height_inches,
      weight_lbs: nullableInt(form.weight_lbs),
      resting_hr: nullableInt(form.resting_hr),
      max_hr: nullableInt(form.max_hr),
      vo2_max: nullableFloat(form.vo2_max),
      years_weight_training: form.years_weight_training,
      longest_run_miles: nullableFloat(form.longest_run_miles),
      highest_weekly_mileage: nullableInt(form.highest_weekly_mileage),
      // Personal Records
      pr_400m_seconds: pr400,
      pr_800m_seconds: pr800,
      pr_1600m_seconds: pr1600,
      pr_3200m_seconds: pr3200,
      pr_5k_seconds: pr5k,
      pr_10k_seconds: pr10k,
      // Training Setup
      team_practice_days: form.team_practice_days,
      years_running: form.years_running ? parseInt(form.years_running, 10) : null,
      injury_history: form.injury_history.trim() || null,
      focus_areas: form.focus_areas.length > 0 ? form.focus_areas : null,
      // Lifting Preferences
      lifting_days_per_week: form.lifting_days_per_week,
      exercises_to_avoid: form.exercises_to_avoid.trim() || null,
      gym_equipment: form.gym_equipment.length > 0 ? form.gym_equipment : null,
      // Coach Preferences
      coach_message_style: form.coach_message_style,
      coach_motivation_style: form.coach_motivation_style,
      morning_reminder_time: form.morning_reminder_time,
      coach_notes: form.coach_notes.trim() || null,
    }

    if (athleteId) {
      await supabase.from('athlete').update(payload).eq('id', athleteId)
    } else {
      const { data } = await supabase
        .from('athlete')
        .insert({ name: 'Athlete', ...payload })
        .select('id')
        .single()
      if (data) setAthleteId(data.id)
    }

    setSaving(false)
    setToast('Profile saved — your coach has been updated')
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-coach-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-coach-700 border border-coach-500 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg animate-slide-in max-w-xs w-[calc(100%-2rem)] text-center">
          {toast}
        </div>
      )}

      <div className="px-4 pt-6 pb-28 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Athlete Profile</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Your coach reads this before every workout</p>
        </div>

        {/* ── Section 1: Running Goals ───────────────────────────────── */}
        <Section title="Running Goals">
          <div>
            <FieldLabel>Current 5K PR</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  placeholder="17"
                  value={form.currentPrMins}
                  onChange={e => set('currentPrMins', e.target.value)}
                  className={inputCls + ' text-center pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">min</span>
              </div>
              <span className="text-zinc-500 font-bold text-lg select-none">:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="45"
                  value={form.currentPrSecs}
                  onChange={e => set('currentPrSecs', e.target.value)}
                  className={inputCls + ' text-center pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">sec</span>
              </div>
            </div>
            {errors.currentPr && (
              <p className="text-xs text-red-400 mt-1.5">{errors.currentPr}</p>
            )}
          </div>

          <div>
            <FieldLabel>Goal 5K PR</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  placeholder="16"
                  value={form.goalPrMins}
                  onChange={e => set('goalPrMins', e.target.value)}
                  className={inputCls + ' text-center pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">min</span>
              </div>
              <span className="text-zinc-500 font-bold text-lg select-none">:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="30"
                  value={form.goalPrSecs}
                  onChange={e => set('goalPrSecs', e.target.value)}
                  className={inputCls + ' text-center pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">sec</span>
              </div>
            </div>
            {errors.goalPr && (
              <p className="text-xs text-red-400 mt-1.5">{errors.goalPr}</p>
            )}
          </div>

          <div>
            <FieldLabel>Season Start Date</FieldLabel>
            <input
              type="date"
              value={form.season_start_date}
              onChange={e => set('season_start_date', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <FieldLabel>Target Weekly Mileage</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={form.target_weekly_mileage}
                onChange={e => set('target_weekly_mileage', e.target.value)}
                className={inputCls + ' pr-28'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">miles/week</span>
            </div>
          </div>

          <div>
            <FieldLabel>Current Weekly Mileage</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={form.current_weekly_mileage}
                onChange={e => set('current_weekly_mileage', e.target.value)}
                className={inputCls + ' pr-28'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">miles/week</span>
            </div>
          </div>

          <div>
            <FieldLabel>Other Goals</FieldLabel>
            <textarea
              value={form.other_goals}
              onChange={e => set('other_goals', e.target.value)}
              placeholder="e.g. Break 5:00 mile, qualify for state"
              rows={3}
              className={textareaCls}
            />
          </div>
        </Section>

        {/* ── Section 2: Body & Performance Metrics ─────────────────── */}
        <Section
          title="Body & Performance Metrics"
          subtitle="Helps your coach calculate precise training zones and load recommendations"
        >
          {/* Height */}
          <div>
            <FieldLabel>Height</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  placeholder="5"
                  value={form.height_ft}
                  onChange={e => set('height_ft', e.target.value)}
                  className={inputCls + ' text-center pr-8'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">ft</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="11"
                  placeholder="11"
                  value={form.height_in}
                  onChange={e => set('height_in', e.target.value)}
                  className={inputCls + ' text-center pr-8'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">in</span>
              </div>
            </div>
          </div>

          {/* Weight */}
          <div>
            <FieldLabel>Weight</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="135"
                value={form.weight_lbs}
                onChange={e => set('weight_lbs', e.target.value)}
                className={inputCls + ' pr-12'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">lbs</span>
            </div>
          </div>

          {/* Resting HR */}
          <div>
            <FieldLabel>Resting Heart Rate</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="e.g. 52"
                value={form.resting_hr}
                onChange={e => set('resting_hr', e.target.value)}
                className={inputCls + ' pr-12'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">bpm</span>
            </div>
            <HelperText>Check your Garmin morning resting HR</HelperText>
          </div>

          {/* Max HR */}
          <div>
            <FieldLabel>Max Heart Rate</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="e.g. 198"
                value={form.max_hr}
                onChange={e => set('max_hr', e.target.value)}
                className={inputCls + ' pr-12'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">bpm</span>
            </div>
            <HelperText>From a hard interval workout — leave blank to use estimated (220 minus age = 204)</HelperText>
          </div>

          {/* VO2 Max */}
          <div>
            <FieldLabel>VO2 Max</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 58.4"
                value={form.vo2_max}
                onChange={e => set('vo2_max', e.target.value)}
                className={inputCls + ' pr-24'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">ml/kg/min</span>
            </div>
            <HelperText>Find this in Garmin Connect app under Performance Stats</HelperText>
          </div>

          {/* Years Weight Training */}
          <div>
            <FieldLabel>Years of Weight Training</FieldLabel>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('years_weight_training', n)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all active:scale-95 ${
                    form.years_weight_training === n
                      ? 'bg-coach-700 border-coach-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {n === 5 ? '5+' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Longest Run */}
          <div>
            <FieldLabel>Longest Run Ever</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 10"
                value={form.longest_run_miles}
                onChange={e => set('longest_run_miles', e.target.value)}
                className={inputCls + ' pr-16'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">miles</span>
            </div>
          </div>

          {/* Highest Weekly Mileage */}
          <div>
            <FieldLabel>Highest Weekly Mileage Ever</FieldLabel>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="e.g. 30"
                value={form.highest_weekly_mileage}
                onChange={e => set('highest_weekly_mileage', e.target.value)}
                className={inputCls + ' pr-24'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">miles/week</span>
            </div>
          </div>
        </Section>

        {/* ── Section 3: Personal Records ────────────────────────────── */}
        <Section
          title="Personal Records"
          subtitle="Used to calculate precise training paces — enter what you have, leave others blank"
        >
          <div className="grid grid-cols-2 gap-3">
            <PrField
              label="400m"
              minVal={form.pr400mMins} secVal={form.pr400mSecs}
              minPlaceholder="0" secPlaceholder="58"
              onMinChange={v => set('pr400mMins', v)}
              onSecChange={v => set('pr400mSecs', v)}
            />
            <PrField
              label="800m"
              minVal={form.pr800mMins} secVal={form.pr800mSecs}
              minPlaceholder="2" secPlaceholder="08"
              onMinChange={v => set('pr800mMins', v)}
              onSecChange={v => set('pr800mSecs', v)}
            />
            <PrField
              label="1600m"
              minVal={form.pr1600mMins} secVal={form.pr1600mSecs}
              minPlaceholder="4" secPlaceholder="52"
              onMinChange={v => set('pr1600mMins', v)}
              onSecChange={v => set('pr1600mSecs', v)}
            />
            <PrField
              label="3200m"
              minVal={form.pr3200mMins} secVal={form.pr3200mSecs}
              minPlaceholder="10" secPlaceholder="30"
              onMinChange={v => set('pr3200mMins', v)}
              onSecChange={v => set('pr3200mSecs', v)}
            />
            <PrField
              label="5K"
              minVal={form.pr5kMins} secVal={form.pr5kSecs}
              minPlaceholder="17" secPlaceholder="35"
              onMinChange={v => set('pr5kMins', v)}
              onSecChange={v => set('pr5kSecs', v)}
            />
            <PrField
              label="10K"
              minVal={form.pr10kMins} secVal={form.pr10kSecs}
              minPlaceholder="38" secPlaceholder="00"
              onMinChange={v => set('pr10kMins', v)}
              onSecChange={v => set('pr10kSecs', v)}
            />
          </div>
        </Section>

        {/* ── Section 4: Training Setup ──────────────────────────────── */}
        <Section title="Training Setup">
          <div>
            <FieldLabel>Team Practice Days</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <Chip
                  key={day}
                  label={DAY_LABELS[day]}
                  selected={form.team_practice_days.includes(day)}
                  onToggle={() => toggleArray('team_practice_days', day)}
                />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Years Running XC</FieldLabel>
            <input
              type="number"
              min="0"
              placeholder="3"
              value={form.years_running}
              onChange={e => set('years_running', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <FieldLabel>Injury History</FieldLabel>
            <textarea
              value={form.injury_history}
              onChange={e => set('injury_history', e.target.value)}
              placeholder="e.g. Shin splints Spring 2025, right knee soreness"
              rows={3}
              className={textareaCls}
            />
          </div>

          <div>
            <FieldLabel>Focus Areas</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTS.map(opt => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={form.focus_areas.includes(opt)}
                  onToggle={() => toggleArray('focus_areas', opt)}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ── Section 5: Lifting Preferences ────────────────────────── */}
        <Section title="Lifting Preferences">
          <div>
            <FieldLabel>Lifting Days Per Week</FieldLabel>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set('lifting_days_per_week', n)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all active:scale-95 ${
                    form.lifting_days_per_week === n
                      ? 'bg-coach-700 border-coach-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Exercises to Avoid</FieldLabel>
            <textarea
              value={form.exercises_to_avoid}
              onChange={e => set('exercises_to_avoid', e.target.value)}
              placeholder="e.g. Heavy squats — right knee"
              rows={2}
              className={textareaCls}
            />
          </div>

          <div>
            <FieldLabel>Available Equipment</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ALL_EQUIPMENT.map(eq => (
                <Chip
                  key={eq}
                  label={eq}
                  selected={form.gym_equipment.includes(eq)}
                  onToggle={() => toggleArray('gym_equipment', eq)}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ── Section 6: Coach Preferences ──────────────────────────── */}
        <Section title="Coach Preferences">
          <div>
            <FieldLabel>Message Style</FieldLabel>
            <Toggle
              options={['brief', 'detailed']}
              value={form.coach_message_style}
              onChange={v => set('coach_message_style', v)}
            />
          </div>

          <div>
            <FieldLabel>Motivation Style</FieldLabel>
            <Toggle
              options={['analytical', 'motivational', 'balanced']}
              value={form.coach_motivation_style}
              onChange={v => set('coach_motivation_style', v)}
            />
          </div>

          <div>
            <FieldLabel>Morning Reminder Time</FieldLabel>
            <input
              type="time"
              value={form.morning_reminder_time}
              onChange={e => set('morning_reminder_time', e.target.value)}
              className={inputCls}
            />
          </div>
        </Section>

        {/* ── Section 7: Open Notes ──────────────────────────────────── */}
        <Section title="Open Notes for Your Coach">
          <div>
            <FieldLabel>Anything else your coach should know?</FieldLabel>
            <textarea
              value={form.coach_notes}
              onChange={e => set('coach_notes', e.target.value)}
              placeholder="e.g. I have a meet this Saturday, coach wants me to focus on hills, feeling burnt out lately, family vacation next week so only 3 training days available..."
              rows={5}
              className={textareaCls}
            />
          </div>
        </Section>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-coach-600 hover:bg-coach-500 active:scale-95 disabled:opacity-60 text-white font-semibold text-sm transition-all"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
