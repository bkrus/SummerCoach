import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'

const ATHLETE_MAX_HR = 200

function classifyEffort(avgHr: number | null, maxHr: number): 'easy' | 'moderate' | 'hard' {
  if (!avgHr) return 'easy'
  if (avgHr < maxHr * 0.75) return 'easy'
  if (avgHr < maxHr * 0.87) return 'moderate'
  return 'hard'
}

type StravaActivity = {
  id: number
  name: string
  sport_type: string
  distance: number
  moving_time: number
  average_heartrate?: number
  max_heartrate?: number
  average_speed: number
  start_date: string
  perceived_exertion?: number
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface SyncResponse {
  newCount: number
}

export async function syncStravaActivities(creds: {
  supabaseUrl: string
  supabaseKey: string
  stravaClientId: string
  stravaClientSecret: string
}): Promise<SyncResponse> {
  const supabase = createClient(creds.supabaseUrl, creds.supabaseKey)

  // Load athlete tokens
  const { data: athlete, error: athleteError } = await supabase
    .from('athlete')
    .select('id, strava_access_token, strava_refresh_token, strava_token_expires_at')
    .maybeSingle()

  if (athleteError || !athlete) throw new Error('No athlete record found')
  if (!athlete.strava_access_token) throw new Error('Strava not connected')

  // Refresh token if expired
  let accessToken = athlete.strava_access_token
  const tokenExpiry = athlete.strava_token_expires_at
    ? new Date(athlete.strava_token_expires_at).getTime()
    : 0

  if (Date.now() >= tokenExpiry) {
    console.log('[strava/sync] Token expired — refreshing')
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: creds.stravaClientId,
        client_secret: creds.stravaClientSecret,
        grant_type: 'refresh_token',
        refresh_token: athlete.strava_refresh_token,
      }),
    })

    if (!refreshRes.ok) {
      const text = await refreshRes.text()
      throw new Error(`Token refresh failed (HTTP ${refreshRes.status}): ${text}`)
    }

    const refreshData = await refreshRes.json() as TokenResponse
    accessToken = refreshData.access_token

    await supabase.from('athlete').update({
      strava_access_token: refreshData.access_token,
      strava_refresh_token: refreshData.refresh_token,
      strava_token_expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
    }).eq('id', athlete.id)

    console.log('[strava/sync] Token refreshed, expires:', new Date(refreshData.expires_at * 1000).toISOString())
  }

  // Use most recent stored activity's start_date as the `after` cursor
  const { data: latestActivity } = await supabase
    .from('activities')
    .select('start_date')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const after = latestActivity?.start_date
    ? Math.floor(new Date(latestActivity.start_date).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60 // fallback: 30 days

  console.log('[strava/sync] Fetching activities after:', new Date(after * 1000).toISOString())

  const activitiesRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!activitiesRes.ok) {
    const text = await activitiesRes.text()
    throw new Error(`Strava API error ${activitiesRes.status}: ${text}`)
  }

  const activities = await activitiesRes.json() as StravaActivity[]
  console.log('[strava/sync] Strava returned', activities.length, 'activities')
  activities.forEach(a => console.log(`  ${a.start_date} | ${a.sport_type} | ${a.name}`))

  if (activities.length === 0) return { newCount: 0 }

  const isRun = (sportType: string) =>
    sportType === 'Run' || sportType === 'TrailRun'

  const rows = activities.map(a => ({
    strava_activity_id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    distance_meters: isRun(a.sport_type) ? (a.distance ?? null) : 0,
    moving_time_seconds: a.moving_time ?? null,
    average_heartrate: a.average_heartrate ?? null,
    max_heartrate: a.max_heartrate ?? null,
    average_speed: a.average_speed ?? null,
    start_date: a.start_date,
    perceived_exertion: a.perceived_exertion ?? null,
    effort_level: isRun(a.sport_type)
      ? classifyEffort(a.average_heartrate ?? null, ATHLETE_MAX_HR)
      : null,
  }))

  const { error: upsertError } = await supabase
    .from('activities')
    .upsert(rows, { onConflict: 'strava_activity_id' })

  if (upsertError) throw upsertError

  return { newCount: activities.length }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end()
    return
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    const stravaClientId = process.env.VITE_STRAVA_CLIENT_ID
    const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET

    if (!supabaseUrl || !supabaseKey || !stravaClientId || !stravaClientSecret) {
      throw new Error('Missing required environment variables')
    }

    const result = await syncStravaActivities({
      supabaseUrl,
      supabaseKey,
      stravaClientId,
      stravaClientSecret,
    })

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (err) {
    console.error('[strava/sync]', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
  }
}
