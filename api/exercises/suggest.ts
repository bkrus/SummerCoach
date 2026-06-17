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
  youtube_url?: string | null
  ai_reasoning: string
}

function buildSystemPrompt(currentExercises: string[]): string {
  const list = currentExercises.length
    ? currentExercises.map(n => `  - ${n}`).join('\n')
    : '  (none yet)'

  return `You are an expert strength coach for high school cross country runners. Your job is to suggest 1-2 NEW exercises that COMPLEMENT the existing workout — do not suggest any exercise already in the current workout list.

CURRENT EXERCISES ALREADY IN THE WORKOUT (DO NOT SUGGEST THESE):
${list}

Requirements for suggestions:
- Must be different from every exercise listed above
- Must use equipment available to the athlete (from context)
- Must NOT involve exercises the athlete should avoid (from context)
- Should address any weaknesses or focus areas (from context)
- Should be appropriate for the athlete's readiness level (from context)
- For a high school XC runner — functional, injury prevention focused

Day types and their focus:
- lower_a: Heavier lower body (hip hinges, split squats, unilateral work, loaded carries)
- lower_b: TRX and lighter lower body (bodyweight-emphasis, goblet squats, TRX work)
- upper: Upper body push/pull and core (rows, presses, face pulls, anti-rotation, dead bugs)
- mobility: Recovery and activation (foam rolling, stretching, glute activation, breathing)

For each suggested exercise provide:
- name: string (be specific)
- equipment: string array (empty array if bodyweight)
- sets: number
- reps: string (e.g., "10", "8 each leg", "30 seconds")
- form_cues: string array (3-5 cues)
- common_mistakes: string array (2-3 mistakes)
- running_benefit: string (one sentence connecting to XC performance)
- ai_reasoning: string (why THIS exercise TODAY for THIS athlete)

Return ONLY a valid JSON array. No markdown, no explanation, just the JSON array.`
}

export async function suggestExercises(
  body: { day_type: string; athlete_context: string; current_exercises?: string[]; save?: boolean },
  config: SuggestConfig
): Promise<SuggestedExercise[]> {
  const currentExercises = body.current_exercises ?? []

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
      system: buildSystemPrompt(currentExercises),
      messages: [
        {
          role: 'user',
          content: `Suggest 1-2 new complementary exercises for a ${body.day_type} lifting session.\n\nAthlete context:\n${body.athlete_context}`,
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

  const parsed = JSON.parse(text) as SuggestedExercise[]

  // Filter out any duplicates the model may have returned despite instructions
  const existingNames = new Set(currentExercises.map(n => n.toLowerCase()))
  const exercises = parsed.filter(ex => !existingNames.has(ex.name.toLowerCase()))

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
    const body = JSON.parse(raw) as { day_type: string; athlete_context: string; current_exercises?: string[]; save?: boolean }

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
