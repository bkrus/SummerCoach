export type StravaActivity = {
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

export function classifyEffort(avgHr: number | null, maxHr: number): 'easy' | 'moderate' | 'hard' {
  if (!avgHr) return 'easy'
  if (avgHr < maxHr * 0.75) return 'easy'
  if (avgHr < maxHr * 0.87) return 'moderate'
  return 'hard'
}

export function buildStravaAuthUrl(): string {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID
  // Derived at runtime so dev (localhost) and prod (summer-coach.vercel.app) both work.
  const redirectUri = `${window.location.origin}/auth/strava/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })
  const url = `https://www.strava.com/oauth/authorize?${params}`

  console.group('[Strava OAuth] buildStravaAuthUrl')
  console.log('client_id   :', clientId)
  console.log('redirect_uri:', redirectUri)
  console.log('response_type: code')
  console.log('scope       : activity:read_all')
  console.log('full url    :', url)
  console.groupEnd()

  return url
}
