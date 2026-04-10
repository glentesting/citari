import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'

export const maxDuration = 30

export async function GET() {
  const log: string[] = []

  // 1. Check env vars
  log.push(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET (' + process.env.ANTHROPIC_API_KEY.slice(0, 8) + '...)' : 'MISSING'}`)
  log.push(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING'}`)
  log.push(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING'}`)

  // 2. Test Supabase connection
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await admin.from('clients').select('id, name').limit(3)
    if (error) {
      log.push(`Supabase query ERROR: ${error.message}`)
    } else {
      log.push(`Supabase OK: ${(data || []).length} clients found`)
      for (const c of (data || [])) {
        log.push(`  - Client: ${c.name} (${c.id})`)
      }
    }

    // 2b. Check if new columns exist
    const { data: cols, error: colErr } = await admin.from('clients').select('name, location, specialization, target_clients').limit(1)
    if (colErr) {
      log.push(`New columns ERROR: ${colErr.message}`)
    } else {
      log.push(`New columns OK: location, specialization, target_clients accessible`)
    }

    // 2c. Check competitors columns
    const { data: compCols, error: compErr } = await admin.from('competitors').select('name, intel_brief, why_winning, visibility_score').limit(1)
    if (compErr) {
      log.push(`Competitor columns ERROR: ${compErr.message}`)
    } else {
      log.push(`Competitor columns OK: intel_brief, why_winning, visibility_score accessible`)
    }
  } catch (e: any) {
    log.push(`Supabase CRASH: ${e.message}`)
  }

  // 3. Test Anthropic API
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    log.push(`Anthropic Haiku OK: "${text}"`)
  } catch (e: any) {
    log.push(`Anthropic Haiku FAILED: ${e.message}`)
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    log.push(`Anthropic Sonnet OK: "${text}"`)
  } catch (e: any) {
    log.push(`Anthropic Sonnet FAILED: ${e.message}`)
  }

  return NextResponse.json({ log })
}
