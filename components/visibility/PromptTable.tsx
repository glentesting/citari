'use client'

import { createClient } from '@/lib/supabase/client'
import type { Prompt, ScanResult } from '@/types'

interface PromptTableProps {
  prompts: Prompt[]
  scanResults: ScanResult[]
  onUpdated: () => void
}

const categoryLabels: Record<string, { label: string; bg: string; text: string }> = {
  awareness: { label: 'Awareness', bg: 'bg-blue-50', text: 'text-blue-700' },
  evaluation: { label: 'Evaluation', bg: 'bg-amber-50', text: 'text-amber-700' },
  purchase: { label: 'Purchase', bg: 'bg-green-50', text: 'text-green-700' },
}

function QualityIndicator({ result }: { result: ScanResult | null }) {
  if (!result) {
    return <span className="w-3.5 h-3.5 rounded-full bg-gray-200" title="Not scanned" />
  }

  const quality = result.mention_quality
  const why = result.why_competitor_wins

  // Leading — crown icon
  if (quality === 'leading') {
    return (
      <span className="text-amber-500" title={`Leading mention (authority: ${result.authority_score || '?'}/10)`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 1l2.39 4.84L17.5 6.7l-3.75 3.66.89 5.14L10 13l-4.64 2.5.89-5.14L2.5 6.7l5.11-.86L10 1z" />
        </svg>
      </span>
    )
  }

  // Supporting — green dot
  if (quality === 'supporting') {
    return <span className="w-3.5 h-3.5 rounded-full bg-green-500" title={`Supporting mention (authority: ${result.authority_score || '?'}/10)`} />
  }

  // Mentioned — gray-green dot
  if (quality === 'mentioned' || result.mentioned) {
    return <span className="w-3.5 h-3.5 rounded-full bg-green-300" title={`Mentioned (authority: ${result.authority_score || '?'}/10)`} />
  }

  // Not mentioned — red if competitor wins, gray otherwise
  if (why) {
    return (
      <span className="relative group">
        <span className="w-3.5 h-3.5 rounded-full bg-red-400 block cursor-help" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-[200px] text-center">
          {why}
        </span>
      </span>
    )
  }

  return <span className="w-3.5 h-3.5 rounded-full bg-gray-300" title="Not mentioned" />
}

export default function PromptTable({ prompts, scanResults, onUpdated }: PromptTableProps) {
  const supabase = createClient()

  // Build a lookup: promptId -> { chatgpt, claude, gemini } latest result
  const latestByPrompt = new Map<string, Record<string, ScanResult>>()
  for (const r of scanResults) {
    if (!latestByPrompt.has(r.prompt_id)) {
      latestByPrompt.set(r.prompt_id, {})
    }
    const existing = latestByPrompt.get(r.prompt_id)!
    // Keep the most recent per model
    if (!existing[r.model] || r.scanned_at > existing[r.model].scanned_at) {
      existing[r.model] = r
    }
  }

  async function toggleActive(prompt: Prompt) {
    await supabase
      .from('prompts')
      .update({ is_active: !prompt.is_active })
      .eq('id', prompt.id)
    onUpdated()
  }

  async function deletePrompt(id: string) {
    await supabase.from('prompts').delete().eq('id', id)
    onUpdated()
  }

  if (prompts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">No prompts yet. Add one above to start tracking AI visibility.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_100px_120px_80px_80px] border-b border-gray-200 bg-gray-50">
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Prompt
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Category
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          <span className="inline-flex gap-3">
            <span title="ChatGPT">G</span>
            <span title="Claude">C</span>
            <span title="Gemini">G</span>
          </span>
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
          Active
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
        </div>
      </div>

      {/* Rows */}
      {prompts.map((prompt) => {
        const cat = categoryLabels[prompt.category] || categoryLabels.awareness
        const results = latestByPrompt.get(prompt.id) || {}
        const gpt = results['chatgpt'] ?? null
        const claude = results['claude'] ?? null
        const gemini = results['gemini'] ?? null

        // Red tint if competitor mentioned but brand not mentioned in any model
        const hasGap = Object.values(results).some(
          (r) => !r.mentioned && r.competitor_mentions && r.competitor_mentions.length > 0
        )

        return (
          <div
            key={prompt.id}
            className={`grid grid-cols-[1fr_100px_120px_80px_80px] border-b border-gray-100 last:border-b-0 ${
              !prompt.is_active ? 'opacity-50' : ''
            } ${hasGap && prompt.is_active ? 'bg-[#FFF8F8]' : ''}`}
          >
            <div className="px-4 py-3 text-sm text-gray-900 flex items-center">
              <span className="line-clamp-2">{prompt.text}</span>
            </div>
            <div className="px-4 py-3 flex items-center">
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${cat.bg} ${cat.text}`}>
                {cat.label}
              </span>
            </div>
            <div className="px-4 py-3 flex items-center justify-center gap-4">
              <QualityIndicator result={gpt || null} />
              <QualityIndicator result={claude || null} />
              <QualityIndicator result={gemini || null} />
            </div>
            <div className="px-4 py-3 flex items-center justify-center">
              <button
                onClick={() => toggleActive(prompt)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  prompt.is_active ? 'bg-brand' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    prompt.is_active ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="px-4 py-3 flex items-center justify-center">
              <button
                onClick={() => deletePrompt(prompt.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Delete prompt"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
