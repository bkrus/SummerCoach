import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type AthleteProfile = {
  id: string
  name: string
  strava_profile_url: string | null
}

export function useAthlete() {
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('athlete')
        .select('id, name, strava_profile_url, strava_access_token')
        .maybeSingle()

      if (cancelled) return
      if (error || !data) {
        console.error('[useAthlete] fetch error:', error)
        setLoading(false)
        return
      }

      // Profile URL already saved — done.
      if (data.strava_profile_url) {
        setAthlete({ id: data.id, name: data.name, strava_profile_url: data.strava_profile_url })
        setLoading(false)
        return
      }

      // Athlete connected before strava_profile_url was added — show name immediately
      // and backfill the photo in the background.
      setAthlete({ id: data.id, name: data.name, strava_profile_url: null })
      setLoading(false)

      if (!data.strava_access_token) return

      try {
        const res = await fetch('https://www.strava.com/api/v3/athlete', {
          headers: { Authorization: `Bearer ${data.strava_access_token}` },
        })
        if (!res.ok || cancelled) return

        const stravaAthlete = await res.json() as { profile?: string; profile_medium?: string }
        console.log('[useAthlete] Strava /athlete profile fields:', {
          profile: stravaAthlete.profile,
          profile_medium: stravaAthlete.profile_medium,
        })

        const profileUrl = stravaAthlete.profile ?? stravaAthlete.profile_medium ?? null
        if (!profileUrl || cancelled) return

        setAthlete((prev) => prev ? { ...prev, strava_profile_url: profileUrl } : prev)

        // Save so we don't fetch again next load
        await supabase
          .from('athlete')
          .update({ strava_profile_url: profileUrl })
          .eq('id', data.id)
      } catch {
        // Non-fatal — profile pic just stays absent
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  return { athlete, loading }
}
