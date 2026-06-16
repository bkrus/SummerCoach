import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'

export interface SuggestConfig {
  supabaseUrl: string
  supabaseKey: string
  anthropicKey: string
}

interface SuggestedExercise {
  name: string
  equipment: string[]
  sets: number
  reps: string
  form_cues: string[]
  common_mistakes: string[]
  running_benefit: string
  ai_reasoning: string
}

const SYSTEM_PROMPT = `You are an expert strength coach specializing in exercises for high school cross-country and distance runners. Given a day type and athlete context, suggest exercises that complement their running training without adding excessive fatigue.

Day types and their focus:
- lower_a: Heavier lower body (hip hinges, split squats, unilateral work, loaded carries)
- lower_b: TRX and lighter lower body (bodyweight-emphasis, goblet squats, TRX work)
- upper: Upper body push/pull and core (rows, presses, face pulls, anti-rotation, dead bugs)
- mobility: Recovery and activation (foam rolling, stretching, glute activation, breathing)

Return a JSON array of exactly 4-6 exercise objects. Each object must have these exact fields:
- name: string
- equipment: string[] (empty array if no equipment needed)
- sets: number
- reps: string (e.g., "10", "8 each leg", "30 seconds", "60 seconds each side")
- form_cues: string[] (exactly 3-4 cues)
- common_mistakes: string[] (exactly 2-3 mistakes)
- running_benefit: string (one sentence on how this helps distance running)
- ai_reasoning: string (one sentence on why this exercise was chosen for this athlete specifically)

Return ONLY a valid JSON array — no markdown code blocks, no explanation outside the JSON.`

export async function suggestExercises(
  body: { day_type: string; athlete_context: string; save?: boolean },
  config: SuggestConfig
): Promise<SuggestedExercise[]> {
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Suggest exercises for a ${body.day_type} lifting session.\n\nAthlete context:\n${body.athlete_context}`,
        },
      ],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    throw new Error(`Claude API error ${claudeRes.status}: ${errText}`)
  }

  const claudeData = await claudeRes.json() as { content: Array<{ type: string; text: string }> }
  const text = claudeData.content.find(b => b.type === 'text')?.text ?? ''

  const exercises = JSON.parse(text) as SuggestedExercise[]

  if (body.save) {
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)
    const rows = exercises.map((ex, i) => ({
      name: ex.name,
      equipment: ex.equipment,
      day_type: body.day_type,
      sort_order: 100 + i,
      sets: ex.sets,
      reps: ex.reps,
      form_cues: ex.form_cues,
      common_mistakes: ex.common_mistakes,
      running_benefit: ex.running_benefit,
      is_ai_suggested: true,
      ai_reasoning: ex.ai_reasoning,
    }))
    await supabase.from('exercises').insert(rows)
  }

  return exercises
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end()
    return
  }

  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })

  try {
    const body = JSON.parse(raw) as { day_type: string; athlete_context: string; save?: boolean }

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (!supabaseUrl || !supabaseKey || !anthropicKey) {
      throw new Error('Missing required environment variables')
    }

    const exercises = await suggestExercises(body, { supabaseUrl, supabaseKey, anthropicKey })

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(exercises))
  } catch (err) {
    console.error('[exercises/suggest]', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (err as Error).message }))
  }
}
