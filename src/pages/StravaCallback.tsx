import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { classifyEffort, type StravaActivity } from '../lib/strava'

const ATHLETE_MAX_HR = 200 // 220 − 16 (athlete age)

type CallbackError = {
  message: string
  stravaError: string | null
  stravaDescription: string | null
  rawParams: Record<string, string>
}

export default function StravaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('Connecting to Strava…')
  const [error, setError] = useState<CallbackError | null>(null)
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const rawParams = Object.fromEntries(searchParams.entries())
    console.group('[Strava OAuth] Callback received')
    console.log('URL params:', rawParams)
    console.groupEnd()

    const stravaError = searchParams.get('error')
    const stravaDescription = searchParams.get('error_description')
    const code = searchParams.get('code')

    if (stravaError) {
      setError({
        message: 'Strava returned an error.',
        stravaError,
        stravaDescription,
        rawParams,
      })
      return
    }
    if (!code) {
      setError({
        message: 'No authorization code in the callback URL.',
        stravaError: null,
        stravaDescription: null,
        rawParams,
      })
      return
    }

    void (async () => {
      try {
        // 1. Exchange code server-side via Vite dev proxy (keeps client secret off the wire)
        setStatus('Exchanging authorization code…')
        const tokenRes = await fetch('/api/strava/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const tokenData = await tokenRes.json() as {
          access_token: string
          refresh_token: string
          expires_at: number
          athlete: { id: number; firstname: string; lastname: string; profile: string }
          message?: string
          errors?: unknown
        }
        console.log('[Strava OAuth] Token exchange status:', tokenRes.status, tokenData)
        console.log('[Strava OAuth] athlete.profile:', tokenData.athlete?.profile)
        console.log('[Strava OAuth] athlete.profile_medium:', (tokenData.athlete as Record<string, unknown>)?.profile_medium)
        if (!tokenRes.ok) {
          throw new Error(
            typeof tokenData.message === 'string'
              ? tokenData.message
              : `Token exchange failed (HTTP ${tokenRes.status})`
          )
        }

        const { access_token, refresh_token, expires_at, athlete } = tokenData

        // 2. Upsert athlete record with Strava tokens
        setStatus('Saving athlete profile…')
        const { error: athleteError } = await supabase.from('athlete').upsert(
          {
            strava_athlete_id: athlete.id,
            name: `${athlete.firstname} ${athlete.lastname}`,
            strava_access_token: access_token,
            strava_refresh_token: refresh_token,
            strava_token_expires_at: new Date(expires_at * 1000).toISOString(),
            strava_profile_url: athlete.profile ?? null,
          },
          { onConflict: 'strava_athlete_id' }
        )
        if (athleteError) throw athleteError

        // 3. Fetch last 30 days of activities from Strava
        setStatus('Fetching runs from Strava…')
        const after = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
        const activitiesRes = await fetch(
          `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        )
        if (!activitiesRes.ok) throw new Error('Failed to fetch Strava activities')

        const all = await activitiesRes.json() as StravaActivity[]
        const runs = all.filter((a) => a.sport_type === 'Run' || a.sport_type === 'TrailRun')

        // 4. Classify by HR zone and store
        if (runs.length > 0) {
          setStatus(`Classifying ${runs.length} run${runs.length === 1 ? '' : 's'}…`)
          const rows = runs.map((a) => ({
            strava_activity_id: a.id,
            name: a.name,
            distance_meters: a.distance ?? null,
            moving_time_seconds: a.moving_time ?? null,
            average_heartrate: a.average_heartrate ?? null,
            max_heartrate: a.max_heartrate ?? null,
            average_speed: a.average_speed ?? null,
            start_date: a.start_date,
            sport_type: a.sport_type,
            perceived_exertion: a.perceived_exertion ?? null,
            effort_level: classifyEffort(a.average_heartrate ?? null, ATHLETE_MAX_HR),
          }))

          const { error: actError } = await supabase
            .from('activities')
            .upsert(rows, { onConflict: 'strava_activity_id' })
          if (actError) throw actError
        }

        navigate('/', { replace: true })
      } catch (err) {
        setError({
          message: (err as Error).message,
          stravaError: null,
          stravaDescription: null,
          rawParams: Object.fromEntries(searchParams.entries()),
        })
      }
    })()
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="flex flex-col h-dvh bg-coach-950 px-4 pt-10 pb-6 overflow-y-auto gap-5">
        <div>
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">OAuth Error</p>
          <p className="text-white font-medium">{error.message}</p>
        </div>

        {error.stravaError && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Strava error</p>
            <p className="text-sm font-mono text-red-400">{error.stravaError}</p>
            {error.stravaDescription && (
              <p className="text-sm text-zinc-300">{error.stravaDescription}</p>
            )}
          </div>
        )}

        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">URL params received</p>
          {Object.keys(error.rawParams).length === 0 ? (
            <p className="text-sm text-zinc-500 italic">none</p>
          ) : (
            Object.entries(error.rawParams).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-xs font-mono text-zinc-400 shrink-0">{k}:</span>
                <span className="text-xs font-mono text-zinc-200 break-all">{v}</span>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-zinc-500">
          Check the browser console for the full auth URL and token exchange response.
        </p>

        <button
          onClick={() => navigate('/', { replace: true })}
          className="mt-auto py-3 rounded-xl bg-zinc-800 text-sm text-zinc-300 font-medium"
        >
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-dvh bg-coach-950 gap-4">
      <div className="w-10 h-10 border-2 border-coach-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-zinc-400">{status}</p>
    </div>
  )
}
