import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { IncomingMessage, ServerResponse } from 'http'

type StravaProxyConfig = {
  clientId: string
  clientSecret: string
}

// Dev-only middleware: exchanges the Strava auth code for tokens server-side
// so STRAVA_CLIENT_SECRET never reaches the browser.
// In production, api/strava/token.ts (Vercel serverless function) handles this.
function stravaTokenProxy(config: StravaProxyConfig): Plugin {
  return {
    name: 'strava-token-proxy',
    configureServer(server) {
      server.middlewares.use('/api/strava/token', (req: IncomingMessage, res: ServerResponse) => {
        handleTokenExchange(req, res, config).catch((err: Error) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        })
      })
    },
  }
}

async function handleTokenExchange(
  req: IncomingMessage,
  res: ServerResponse,
  config: StravaProxyConfig
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }

  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })

  const { code } = JSON.parse(raw) as { code: string }

  // Derive redirect_uri from the browser's Origin header — matches what
  // buildStravaAuthUrl() sends, and works without a hardcoded env var.
  const origin = req.headers.origin ?? 'http://localhost:5173'
  const redirectUri = `${origin}/auth/strava/callback`

  const payload = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  }

  console.log('[Strava /api/strava/token] outgoing payload:', {
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
  console.log(`[Strava /api/strava/token] Strava response: HTTP ${stravaRes.status}`, data)

  res.statusCode = stravaRes.status
  res.setHeader('Content-Type', 'application/json')
  res.end(data)
}

export default defineConfig(({ mode }) => {
  // prefix '' loads ALL vars from .env, including non-VITE_ ones like STRAVA_CLIENT_SECRET
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      stravaTokenProxy({
        clientId: env.VITE_STRAVA_CLIENT_ID,
        clientSecret: env.STRAVA_CLIENT_SECRET,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          name: 'XC Coach',
          short_name: 'XC Coach',
          description: 'Your personal cross country coaching companion',
          theme_color: '#1E6B3C',
          background_color: '#050f08',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
      }),
    ],
  }
})
