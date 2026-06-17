import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'

type ReadinessStatus = 'green' | 'yellow' | 'red'

type TodayRunSummary = {
  name: string
  distance_miles: number
  duration_minutes: number
  average_heartrate: number | null
  effort_level: string | null
}

type TodayLiftSummary = {
  name: string
  duration_minutes: number
}

export interface CoachingResponse {
  message: string
  readiness: ReadinessStatus | null
  generatedAt: string
  weeklyMiles: number
  hasRunToday: boolean
  hasLiftedToday: boolean
  todayRunSummary: TodayRunSummary | null
  todayLiftSummary: TodayLiftSummary | null
}

function calcReadiness(leg: number, energy: number, sleepHours: number): ReadinessStatus {
  if (leg >= 4 && energy >= 4 && sleepHours >= 7) return 'green'
  if (leg >= 2 && energy >= 2 && sleepHours >= 5) return 'yellow'
  return 'red'
}

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtMiles(meters: number | null): string {
  if (!meters) return '0 mi'
  return `${(meters / 1609.34).toFixed(2)} mi`
}

function fmtHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

function fmtPace(secsPerMile: number): string {
  return fmtSecs(Math.round(secsPerMile))
}

function calcHRZones(restingHR: number, maxHR: number): string {
  const hrr = maxHR - restingHR
  const z = (lo: number, hi: number) =>
    `${Math.round(restingHR + hrr * lo)}–${Math.round(restingHR + hrr * hi)}`
  return `Z1 ${z(0.50, 0.60)} | Z2 ${z(0.60, 0.70)} | Z3 ${z(0.70, 0.80)} | Z4 ${z(0.80, 0.90)} | Z5 ${z(0.90, 1.00)} bpm`
}

// Jack Daniels-based pace factors from 5K PR
function derivePaces(pr5kSeconds: number): string {
  const secPerMile = pr5kSeconds / 3.10686
  return [
    `Easy: ${fmtPace(secPerMile * 1.30)}/mi`,
    `Marathon: ${fmtPace(secPerMile * 1.15)}/mi`,
    `Threshold: ${fmtPace(secPerMile * 1.08)}/mi`,
    `Interval: ${fmtPace(secPerMile * 0.98)}/mi`,
    `Rep: ${fmtPace(secPerMile * 0.92)}/mi`,
  ].join(' | ')
}

// ─── Athlete profile shape from DB select ────────────────────────────────────

type AthleteProfile = {
  name: string
  current_pr_seconds: number | null
  goal_pr_seconds: number | null
  season_start_date: string | null
  target_weekly_mileage: number
  current_weekly_mileage: number
  team_practice_days: string[]
  years_running: number | null
  injury_history: string | null
  focus_areas: string[] | null
  lifting_days_per_week: number
  exercises_to_avoid: string | null
  gym_equipment: string[] | null
  coach_message_style: string
  coach_motivation_style: string
  other_goals: string | null
  coach_notes: string | null
  // Physiological data
  height_inches: number | null
  weight_lbs: number | null
  resting_hr: number | null
  max_hr: number | null
  vo2_max: number | null
  years_weight_training: number | null
  longest_run_miles: number | null
  highest_weekly_mileage: number | null
  // Personal records
  pr_400m_seconds: number | null
  pr_800m_seconds: number | null
  pr_1600m_seconds: number | null
  pr_3200m_seconds: number | null
  pr_5k_seconds: number | null
  pr_10k_seconds: number | null
}

// ─── Dynamic system prompt ────────────────────────────────────────────────────

function buildSystemPrompt(athlete: AthleteProfile | null): string {
  const name = athlete?.name.split(' ')[0] ?? 'Athlete'
  const currentPR = athlete?.current_pr_seconds ? fmtSecs(athlete.current_pr_seconds) : 'unknown'
  const goalPR = athlete?.goal_pr_seconds ? fmtSecs(athlete.goal_pr_seconds) : 'unknown'

  const messageStyle = athlete?.coach_message_style ?? 'balanced'
  const motivationStyle = athlete?.coach_motivation_style ?? 'balanced'

  const lengthRule =
    messageStyle === 'brief'
      ? 'Keep it under 100 words — very punchy, every word counts.'
      : 'Keep it under 200 words — thorough but still coach-like, not clinical.'

  const toneRule =
    motivationStyle === 'analytical'
      ? 'Tone: data-focused and precise. Reference numbers, percentages, and specific metrics. Explain the why with training science and logic.'
      : motivationStyle === 'motivational'
      ? 'Tone: high energy and encouraging. Focus on belief, momentum, and identity. Light on numbers, heavy on drive and confidence.'
      : 'Tone: balanced mix of data and encouragement. Reference key numbers but wrap them in motivational framing.'

  const lines: string[] = []

  const practiceDays = athlete?.team_practice_days ?? []
  if (practiceDays.length > 0) {
    lines.push(
      `Team practice days are ${practiceDays.join(', ')} — these are FIXED. Never suggest changing or skipping practice on those days.`
    )
  }

  if (athlete?.injury_history) {
    lines.push(
      `Injury history: ${athlete.injury_history}. Factor this into all workout recommendations — avoid aggravating these areas.`
    )
  }

  const focusAreas = athlete?.focus_areas ?? []
  if (focusAreas.length > 0) {
    lines.push(`Training focus areas: ${focusAreas.join(', ')}. Weight recommendations toward these.`)
  }

  if (athlete?.exercises_to_avoid) {
    lines.push(`NEVER recommend these exercises: ${athlete.exercises_to_avoid}.`)
  }

  const equipment = athlete?.gym_equipment ?? []
  if (equipment.length > 0) {
    lines.push(`Only recommend exercises using this available equipment: ${equipment.join(', ')}.`)
  }

  // HR zones — only emit when both values present
  if (athlete?.resting_hr && athlete?.max_hr) {
    lines.push(
      `Training HR zones (Karvonen): ${calcHRZones(athlete.resting_hr, athlete.max_hr)}. Prescribe runs with a specific target zone, not just a vague effort level.`
    )
  } else if (athlete?.max_hr) {
    lines.push(
      `Max HR: ${athlete.max_hr} bpm. Use percentage of max HR for workout prescriptions when referencing heart rate.`
    )
  }

  // Training paces from 5K PR
  const pr5k = athlete?.pr_5k_seconds ?? athlete?.current_pr_seconds
  if (pr5k) {
    lines.push(
      `Derived training paces from 5K PR (${fmtSecs(pr5k)}): ${derivePaces(pr5k)}. Use these specific paces when prescribing run workouts.`
    )
  }

  // Weight training experience
  if (athlete?.years_weight_training != null) {
    const exp =
      athlete.years_weight_training === 0
        ? 'no weight training experience — keep form cues simple and loads conservative'
        : athlete.years_weight_training === 1
        ? '1 year weight training experience — still building movement patterns'
        : athlete.years_weight_training >= 4
        ? `${athlete.years_weight_training}+ years weight training — can handle complex movements and progressive loading`
        : `${athlete.years_weight_training} years weight training experience`
    lines.push(`Lifting background: ${exp}.`)
  }

  const constraints = lines.join('\n')

  return `You are an expert high school cross country coach. Your athlete is ${name}, targeting a ${goalPR} 5K (currently ${currentPR} PR). You have access to daily check-in data, recent Strava activities, and recovery metrics.

Generate a personalized daily coaching message that:
- Addresses ${name} by name
- References specific data from the check-in and recent activities
- Recommends today's workout (run type, distance, pace) adjusted for readiness
- Recommends whether to lift today and what type (Lower A / Lower B / Upper / Mobility / Rest)
- Explains WHY in 1-2 sentences — connects to the goal PR
- Ends with one sentence specific to where they are in the training cycle

${lengthRule}
${toneRule}

Readiness rules:
- Green: execute planned workout
- Yellow: drop intensity one level, reduce volume 20%
- Red: easy shakeout or rest only, no lifting heavy

DAILY ACTIVITY AWARENESS — CRITICAL RULES:
You will be told what activities have already happened today in TODAY'S COMPLETED ACTIVITIES. Follow these rules strictly:

1. IF a run has already happened today:
   - NEVER suggest another run
   - Analyze the completed run: comment on distance, effort level, HR, and what it means for recovery and tomorrow's training
   - Recommend whether to lift based on run effort: hard effort → upper body only or rest from lifting; moderate effort → upper body safe, lower body optional; easy effort → any lift type acceptable

2. IF no run has happened today:
   - Recommend today's run with specific type, distance, and target pace based on readiness and training context
   - Factor in whether it is a team practice day

3. IF lifting has already happened today:
   - Acknowledge it was completed
   - Never suggest additional lifting

4. IF both run and lift are complete:
   - Do not suggest any more training
   - Give a positive day summary and connect today's training to the goal PR
   - Preview what tomorrow looks like so the athlete can prepare

5. ALWAYS end with a one-sentence tomorrow preview — what's coming next

${constraints}

If COACH NOTES are provided and they affect today's plan, explicitly acknowledge them in the message.

Always output plain conversational text — no markdown, no bullet points, no headers. Write like a coach texting their athlete.`
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function buildCoachingMessage(creds: {
  supabaseUrl: string
  supabaseKey: string
  anthropicKey: string
}): Promise<CoachingResponse> {
  const supabase = createClient(creds.supabaseUrl, creds.supabaseKey)

  const today = new Date().toISOString().split('T')[0]
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const now = new Date()
  const utcDay = now.getUTCDay() // 0=Sun, 1=Mon … 6=Sat
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysFromMonday)
  monday.setUTCHours(0, 0, 0, 0)

  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setUTCDate(todayStart.getUTCDate() + 1)

  const [athleteRes, checkinRes, activitiesRes, recoveryRes, weeklyRes, todayActivitiesRes] = await Promise.all([
    supabase
      .from('athlete')
      .select(
        'name, current_pr_seconds, goal_pr_seconds, season_start_date, ' +
        'target_weekly_mileage, current_weekly_mileage, team_practice_days, years_running, ' +
        'injury_history, focus_areas, lifting_days_per_week, exercises_to_avoid, ' +
        'gym_equipment, coach_message_style, coach_motivation_style, other_goals, coach_notes, ' +
        'height_inches, weight_lbs, resting_hr, max_hr, vo2_max, years_weight_training, ' +
        'longest_run_miles, highest_weekly_mileage, ' +
        'pr_400m_seconds, pr_800m_seconds, pr_1600m_seconds, pr_3200m_seconds, ' +
        'pr_5k_seconds, pr_10k_seconds'
      )
      .single(),
    supabase.from('checkins').select('leg_fatigue, energy_level, sleep_hours, pain_areas, notes').eq('date', today).maybeSingle(),
    supabase.from('activities').select('name, distance_meters, moving_time_seconds, average_heartrate, effort_level, start_date').gte('start_date', seventyTwoHoursAgo).order('start_date', { ascending: false }),
    supabase.from('recovery_metrics').select('*').order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('activities').select('distance_meters, start_date').gte('start_date', monday.toISOString()).in('sport_type', ['Run', 'TrailRun']),
    supabase.from('activities')
      .select('name, sport_type, distance_meters, moving_time_seconds, average_heartrate, effort_level')
      .gte('start_date', todayStart.toISOString())
      .lt('start_date', tomorrowStart.toISOString()),
  ])

  const athlete = athleteRes.data as AthleteProfile | null
  const checkin = checkinRes.data
  const activities = activitiesRes.data ?? []
  const recovery = recoveryRes.data
  const weeklyActivities = weeklyRes.data ?? []
  const todayActivities = todayActivitiesRes.data ?? []

  console.log('[coaching-message] week window:', monday.toISOString(), '→', now.toISOString())
  console.log('[coaching-message] weekly activities:', weeklyActivities.map(a => ({
    date: (a as { start_date?: string }).start_date ?? 'unknown',
    miles: ((a.distance_meters ?? 0) / 1609.34).toFixed(2),
  })))

  // ─── Today's activity detection ─────────────────────────────────────────────

  const todayRuns = todayActivities.filter(
    a => a.sport_type === 'Run' || a.sport_type === 'TrailRun'
  )
  const todayLifts = todayActivities.filter(
    a => a.sport_type === 'WeightTraining' || a.sport_type === 'Workout'
  )

  const hasRunToday = todayRuns.length > 0
  const hasLiftedToday = todayLifts.length > 0

  const firstRun = todayRuns[0] ?? null
  const todayRunSummary = firstRun
    ? {
        name: firstRun.name,
        distance_miles: parseFloat(((firstRun.distance_meters ?? 0) / 1609.34).toFixed(1)),
        duration_minutes: Math.round((firstRun.moving_time_seconds ?? 0) / 60),
        average_heartrate: firstRun.average_heartrate ?? null,
        effort_level: firstRun.effort_level ?? null,
      }
    : null

  const firstLift = todayLifts[0] ?? null
  const todayLiftSummary = firstLift
    ? {
        name: firstLift.name,
        duration_minutes: Math.round((firstLift.moving_time_seconds ?? 0) / 60),
      }
    : null

  console.log('[coaching-message] today window:', todayStart.toISOString(), '→', tomorrowStart.toISOString())
  console.log('[coaching-message] today detection:', {
    hasRunToday,
    hasLiftedToday,
    todayRunSummary,
    todayLiftSummary,
  })

  const readiness: ReadinessStatus | null =
    checkin?.leg_fatigue && checkin.energy_level && checkin.sleep_hours
      ? calcReadiness(checkin.leg_fatigue, checkin.energy_level, checkin.sleep_hours)
      : null

  const weeklyMiles = weeklyActivities.reduce(
    (sum, a) => sum + (a.distance_meters ?? 0) / 1609.34,
    0
  )

  const currentPR = athlete?.current_pr_seconds ?? 1055
  const goalPR = athlete?.goal_pr_seconds ?? 960
  const improvementSecs = currentPR - goalPR

  const daysUntilSeason = athlete?.season_start_date
    ? Math.ceil((new Date(athlete.season_start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  // ─── Build context ──────────────────────────────────────────────────────────

  const parts: string[] = []

  const trainingLine = [
    `Current PR: ${fmtSecs(currentPR)} | Goal: ${fmtSecs(goalPR)} | Need to drop: ${fmtSecs(improvementSecs)}`,
    `Weekly mileage: ${weeklyMiles.toFixed(1)} mi (target: ${athlete?.target_weekly_mileage ?? 50} mi/week)`,
    daysUntilSeason != null ? `Days until season: ${daysUntilSeason}` : null,
  ].filter(Boolean).join('\n')

  parts.push(`TRAINING CONTEXT:\n${trainingLine}`)

  // Athlete profile snapshot
  const profileLines: string[] = []
  if (athlete?.years_running != null) profileLines.push(`Years running XC: ${athlete.years_running}`)
  if (athlete?.current_weekly_mileage != null) profileLines.push(`Typical weekly mileage: ${athlete.current_weekly_mileage} mi`)
  if (athlete?.lifting_days_per_week != null) profileLines.push(`Lifting days/week: ${athlete.lifting_days_per_week}`)
  if (athlete?.other_goals) profileLines.push(`Other goals: ${athlete.other_goals}`)
  if (profileLines.length > 0) {
    parts.push(`ATHLETE PROFILE:\n${profileLines.join(' | ')}`)
  }

  // Physiological profile
  const physioLines: string[] = []
  if (athlete?.height_inches != null) physioLines.push(`Height: ${fmtHeight(athlete.height_inches)}`)
  if (athlete?.weight_lbs != null) physioLines.push(`Weight: ${athlete.weight_lbs} lbs`)
  if (athlete?.resting_hr != null) physioLines.push(`Resting HR: ${athlete.resting_hr} bpm`)
  if (athlete?.max_hr != null) physioLines.push(`Max HR: ${athlete.max_hr} bpm`)
  if (athlete?.vo2_max != null) physioLines.push(`VO2 Max: ${athlete.vo2_max} ml/kg/min`)
  if (athlete?.years_weight_training != null) physioLines.push(`Weight training: ${athlete.years_weight_training === 5 ? '5+' : athlete.years_weight_training} yr`)
  if (athlete?.longest_run_miles != null) physioLines.push(`Longest run ever: ${athlete.longest_run_miles} mi`)
  if (athlete?.highest_weekly_mileage != null) physioLines.push(`Peak weekly mileage ever: ${athlete.highest_weekly_mileage} mi/wk`)

  if (physioLines.length > 0) {
    let physioSection = `PHYSIOLOGICAL PROFILE:\n${physioLines.join(' | ')}`

    if (athlete?.resting_hr && athlete?.max_hr) {
      physioSection += `\nHR Zones (Karvonen): ${calcHRZones(athlete.resting_hr, athlete.max_hr)}`
    }

    parts.push(physioSection)
  }

  // Personal records + derived paces
  const prLines: string[] = []
  if (athlete?.pr_400m_seconds) prLines.push(`400m: ${fmtSecs(athlete.pr_400m_seconds)}`)
  if (athlete?.pr_800m_seconds) prLines.push(`800m: ${fmtSecs(athlete.pr_800m_seconds)}`)
  if (athlete?.pr_1600m_seconds) prLines.push(`1600m: ${fmtSecs(athlete.pr_1600m_seconds)}`)
  if (athlete?.pr_3200m_seconds) prLines.push(`3200m: ${fmtSecs(athlete.pr_3200m_seconds)}`)
  if (athlete?.pr_5k_seconds) prLines.push(`5K: ${fmtSecs(athlete.pr_5k_seconds)}`)
  if (athlete?.pr_10k_seconds) prLines.push(`10K: ${fmtSecs(athlete.pr_10k_seconds)}`)

  if (prLines.length > 0) {
    const pr5kForPaces = athlete?.pr_5k_seconds ?? athlete?.current_pr_seconds
    let prSection = `PERSONAL RECORDS:\n${prLines.join(' | ')}`
    if (pr5kForPaces) {
      prSection += `\nDerived training paces: ${derivePaces(pr5kForPaces)}`
    }
    parts.push(prSection)
  }

  if (checkin) {
    parts.push(
      `TODAY'S CHECK-IN (readiness: ${readiness?.toUpperCase() ?? 'UNKNOWN'}):\nLegs: ${checkin.leg_fatigue}/5 | Energy: ${checkin.energy_level}/5 | Sleep: ${checkin.sleep_hours}h\nPain: ${checkin.pain_areas?.join(', ') || 'None'}${checkin.notes ? ` | Notes: ${checkin.notes}` : ''}`
    )
  } else {
    parts.push("TODAY'S CHECK-IN: Not yet submitted — assume moderate readiness")
  }

  const completedParts: string[] = []
  if (todayRunSummary) {
    completedParts.push(
      `TODAY'S COMPLETED RUN: ${todayRunSummary.name} — ${todayRunSummary.distance_miles} miles, ${todayRunSummary.duration_minutes} min, avg HR ${todayRunSummary.average_heartrate ?? '—'}, effort: ${todayRunSummary.effort_level ?? '—'}`
    )
  }
  if (todayLiftSummary) {
    completedParts.push(
      `TODAY'S COMPLETED LIFT: ${todayLiftSummary.name} — ${todayLiftSummary.duration_minutes} min`
    )
  }
  if (completedParts.length === 0) {
    completedParts.push("TODAY'S COMPLETED ACTIVITIES: None yet")
  }
  parts.push(completedParts.join('\n'))

  if (activities.length > 0) {
    const actLines = activities
      .map(
        a =>
          `  ${a.name} (${a.start_date.split('T')[0]}): ${fmtMiles(a.distance_meters)}, ${fmtSecs(a.moving_time_seconds ?? 0)}, HR ${a.average_heartrate ?? '—'}, effort: ${a.effort_level ?? '—'}`
      )
      .join('\n')
    parts.push(`LAST 72 HOURS:\n${actLines}`)
  } else {
    parts.push('LAST 72 HOURS: No activities logged')
  }

  if (recovery) {
    parts.push(
      `RECOVERY METRICS (${recovery.date}):\nBody battery: ${recovery.body_battery_min ?? '—'}–${recovery.body_battery_max ?? '—'} avg ${recovery.body_battery_avg ?? '—'} | HRV: ${recovery.hrv_status ?? '—'} | RHR: ${recovery.resting_heartrate ?? '—'} | Sleep score: ${recovery.sleep_score ?? '—'}`
    )
  }

  // Coach notes last — highest priority signal for Claude
  if (athlete?.coach_notes) {
    parts.push(`⚠ COACH NOTES (high priority — may override standard plan):\n${athlete.coach_notes}`)
  }

  // ─── Call Claude ────────────────────────────────────────────────────────────

  const messageStyle = athlete?.coach_message_style ?? 'balanced'
  const maxTokens = messageStyle === 'brief' ? 200 : 400

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': creds.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: buildSystemPrompt(athlete),
      messages: [{ role: 'user', content: parts.join('\n\n') }],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    throw new Error(`Claude API error ${claudeRes.status}: ${errText}`)
  }

  const claudeData = await claudeRes.json() as { content: Array<{ type: string; text: string }> }
  const message = claudeData.content.find(b => b.type === 'text')?.text ?? 'Unable to generate message.'

  return {
    message,
    readiness,
    generatedAt: new Date().toISOString(),
    weeklyMiles: parseFloat(weeklyMiles.toFixed(1)),
    hasRunToday,
    hasLiftedToday,
    todayRunSummary,
    todayLiftSummary,
  }
}

// ─── Vercel/Node handler ──────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (!supabaseUrl || !supabaseKey || !anthropicKey) {
      throw new Error('Missing required environment variables')
    }

    const result = await buildCoachingMessage({ supabaseUrl, supabaseKey, anthropicKey })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (err) {
    console.error('[coaching-message]', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
  }
}
