import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useStravaStatus() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('athlete')
      .select('strava_athlete_id')
      .not('strava_athlete_id', 'is', null)
      .maybeSingle()
      .then(({ data }) => {
        setConnected(!!data)
        setLoading(false)
      })
  }, [])

  return { connected, loading }
}
