import type { IncomingMessage, ServerResponse } from 'http'

// Vercel serverless function — mirrors the Vite dev proxy so the same
// /api/strava/token path works in both development and production.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end()
    return
  }

  try {
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString()))
      req.on('error', reject)
    })

    const { code } = JSON.parse(raw) as { code: string }

    // Derive redirect_uri from the incoming Origin so it works for any deploy
    // (localhost in dev, summer-coach.vercel.app in production).
    const origin = req.headers.origin ?? `https://${req.headers.host ?? ''}`
    const redirectUri = `${origin}/auth/strava/callback`

    const payload = {
      client_id: process.env.VITE_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    }

    console.log('[strava/token] outgoing payload:', {
      client_id: payload.client_id,
      client_secret: payload.client_secret
        ? `${payload.client_secret.slice(0, 4)}... (${payload.client_secret.length} chars)`
        : 'MISSING',
      redirect_uri: payload.redirect_uri,
      grant_type: payload.grant_type,
      code: `${code.slice(0, 6)}... (${code.length} chars)`,
    })

    const stravaRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await stravaRes.text()
    console.log(`[strava/token] Strava response: HTTP ${stravaRes.status}`, data)

    res.writeHead(stravaRes.status, { 'Content-Type': 'application/json' })
    res.end(data)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
  }
}
