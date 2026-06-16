import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/database.types'

type ReadinessStatus = 'green' | 'yellow' | 'red'

export interface CoachingResponse {
  message: string
  readiness: ReadinessStatus | null
  generatedAt: string
  weeklyMiles: number
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

const SYSTEM_PROMPT = `You are an expert high school cross country coach. Your athlete is Joe, a 16-year-old male targeting a sub-16:00 5K (currently 17:35 PR). You have access to his daily check-in data, recent Strava activities, and recovery metrics.

Generate a personalized daily coaching message that:
- Addresses Joe by name
- References specific data from his check-in and recent activities
- Recommends today's workout (run type, distance, pace) adjusted for his current readiness
- Recommends whether to lift today and what type (Lower A / Lower B / Upper / Mobility / Rest)
- Explains WHY in 1-2 sentences — connects to his sub-16 goal
- Ends with one motivational sentence specific to where he is in the training cycle
- Keep it under 150 words — punchy and coach-like, not clinical

Readiness rules:
- Green: execute planned workout
- Yellow: drop intensity one level, reduce volume 20%
- Red: easy shakeout or rest only, no lifting heavy

Always output plain conversational text — no markdown, no bullet points, no headers. Write like a coach texting his athlete.`

export async function buildCoachingMessage(creds: {
  supabaseUrl: string
  supabaseKey: string
  anthropicKey: string
}): Promise<CoachingResponse> {
  const supabase = createClient<Database>(creds.supabaseUrl, creds.supabaseKey)

  const today = new Date().toISOString().split('T')[0]
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  monday.setHours(0, 0, 0, 0)

  const [athleteRes, checkinRes, activitiesRes, recoveryRes, weeklyRes] = await Promise.all([
    supabase.from('athlete').select('name, current_pr_seconds, goal_pr_seconds, season_start_date').single(),
    supabase.from('checkins').select('leg_fatigue, energy_level, sleep_hours, pain_areas, notes').eq('date', today).maybeSingle(),
    supabase.from('activities').select('name, distance_meters, moving_time_seconds, average_heartrate, effort_level, start_date').gte('start_date', seventyTwoHoursAgo).order('start_date', { ascending: false }),
    supabase.from('recovery_metrics').select('*').order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('activities').select('distance_meters').gte('start_date', monday.toISOString()),
  ])

  const athlete = athleteRes.data
  const checkin = checkinRes.data
  const activities = activitiesRes.data ?? []
  const recovery = recoveryRes.data
  const weeklyActivities = weeklyRes.data ?? []

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

  const parts: string[] = []

  parts.push(
    `TRAINING CONTEXT:\nCurrent PR: ${fmtSecs(currentPR)} | Goal: ${fmtSecs(goalPR)} | Need to drop: ${fmtSecs(improvementSecs)}\nWeekly mileage: ${weeklyMiles.toFixed(1)} mi${daysUntilSeason != null ? ` | Days until season: ${daysUntilSeason}` : ''}`
  )

  if (checkin) {
    parts.push(
      `TODAY'S CHECK-IN (readiness: ${readiness?.toUpperCase() ?? 'UNKNOWN'}):\nLegs: ${checkin.leg_fatigue}/5 | Energy: ${checkin.energy_level}/5 | Sleep: ${checkin.sleep_hours}h\nPain: ${checkin.pain_areas?.join(', ') || 'None'}${checkin.notes ? ` | Notes: ${checkin.notes}` : ''}`
    )
  } else {
    parts.push('TODAY\'S CHECK-IN: Not yet submitted — assume moderate readiness')
  }

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

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': creds.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
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
  }
}

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
