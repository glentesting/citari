'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface ContentGeneratorProps {
  onGenerated: () => void
  prefillPrompt?: string
}

const contentTypes = [
  { value: 'article', label: 'Article', desc: 'In-depth authoritative piece' },
  { value: 'comparison', label: 'Comparison', desc: 'vs. competitor analysis' },
  { value: 'faq', label: 'FAQ', desc: 'Schema-ready Q&A format' },
  { value: 'landing', label: 'Landing Page', desc: 'Conversion-focused copy' },
]

const tones = [
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'technical', label: 'Technical' },
  { value: 'executive', label: 'Executive' },
]

const wordCounts = [
  { value: 600, label: '600 words' },
  { value: 800, label: '800 words' },
  { value: 1200, label: '1,200 words' },
  { value: 1800, label: '1,800 words' },
  { value: 2500, label: '2,500 words' },
]

export default function ContentGenerator({ onGenerated, prefillPrompt = '' }: ContentGeneratorProps) {
  const { activeClient } = useClient()
  const [targetPrompt, setTargetPrompt] = useState(prefillPrompt)
  const [contentType, setContentType] = useState('article')
  const [tone, setTone] = useState('authoritative')
  const [wordCount, setWordCount] = useState(1200)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null)
  const [promptIdeas, setPromptIdeas] = useState<string[]>([])
  const [showIdeas, setShowIdeas] = useState(false)

  useEffect(() => {
    async function loadIdeas() {
      if (!activeClient) return
      const supabase = createClient()
      // Try tracked prompts first
      const { data: prompts } = await supabase
        .from('prompts')
        .select('text')
        .eq('client_id', activeClient.id)
        .eq('is_active', true)
        .limit(5)
      if (prompts && prompts.length > 0) {
        setPromptIdeas(prompts.map((p) => p.text))
      } else {
        // Generate from industry
        const ind = activeClient.industry || activeClient.name
        setPromptIdeas([
          `What's the best ${ind.toLowerCase()} near me?`,
          `How do I choose a good ${ind.toLowerCase()}?`,
          `${ind} reviews and recommendations`,
          `Top ${ind.toLowerCase()} companies for small businesses`,
          `What does a ${ind.toLowerCase()} actually do?`,
        ])
      }
    }
    loadIdeas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  async function handleGenerate() {
    if (!activeClient || !targetPrompt.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)

    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: activeClient.id,
          target_prompt: targetPrompt.trim(),
          content_type: contentType,
          tone,
          word_count: wordCount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Generation failed')
      } else {
        setPreview({ title: data.title, content: data.content })
        onGenerated()
      }
    } catch (e) {
      console.error('Failed to generate geo content:', e)
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6">
      {/* Left: Generator Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Generate AI Content</h3>
          <p className="text-xs text-gray-500">
            Create content optimized for AI citation across ChatGPT, Claude, and Gemini.
          </p>
        </div>

        {/* Target Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">
              Target prompt <span className="text-red-500">*</span>
            </label>
            {promptIdeas.length > 0 && (
              <button type="button" onClick={() => setShowIdeas(!showIdeas)} className="text-xs text-brand hover:underline">
                {showIdeas ? 'Hide ideas' : 'Need ideas?'}
              </button>
            )}
          </div>
          {showIdeas && promptIdeas.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {promptIdeas.map((idea, i) => (
                <button key={i} type="button" onClick={() => { setTargetPrompt(idea); setShowIdeas(false) }}
                  className="px-2.5 py-1 text-xs bg-brand-bg text-brand rounded-full border border-brand-border hover:bg-brand hover:text-white transition-colors truncate max-w-full">
                  {idea}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={targetPrompt}
            onChange={(e) => setTargetPrompt(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
            placeholder='The AI query this content should answer, e.g. "What are the best project management tools for agencies?"'
          />
        </div>

        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Content type</label>
          <div className="grid grid-cols-4 gap-2">
            {contentTypes.map((ct) => (
              <button
                key={ct.value}
                type="button"
                onClick={() => setContentType(ct.value)}
                className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  contentType === ct.value
                    ? 'border-brand bg-brand-bg'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className={`block text-sm font-medium ${
                  contentType === ct.value ? 'text-brand' : 'text-gray-900'
                }`}>
                  {ct.label}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">{ct.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tone + Word Count */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
            >
              {tones.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Word count</label>
            <select
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
            >
              {wordCounts.map((wc) => (
                <option key={wc.value} value={wc.value}>{wc.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !targetPrompt.trim() || !activeClient}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              Generate Content
            </>
          )}
        </button>

        {/* Content Preview */}
        {preview && (
          <div className="border-t border-gray-200 pt-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Generated Content</h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`# ${preview.title}\n\n${preview.content}`)
                }}
                className="text-xs text-brand font-medium hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 mb-3">{preview.title}</h2>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {preview.content}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Tips Panel */}
      <div className="space-y-4">
        <div className="bg-brand-bg border border-brand-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-brand mb-3">GEO Best Practices</h3>
          <ul className="space-y-2.5 text-xs text-gray-700">
            <li className="flex gap-2">
              <span className="text-brand font-bold mt-px">1.</span>
              <span>Answer the target prompt in the <strong>first paragraph</strong> — AI models prioritize direct answers.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold mt-px">2.</span>
              <span>Include an <strong>FAQ section</strong> with 5+ Q&As — these are highly cited by all three AI models.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold mt-px">3.</span>
              <span>Cite <strong>authoritative sources</strong> by name — AI models trust content that references known entities.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold mt-px">4.</span>
              <span>Use <strong>comparison language</strong> — &quot;vs&quot;, &quot;compared to&quot;, &quot;alternatives&quot; triggers evaluation queries.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand font-bold mt-px">5.</span>
              <span>Keep paragraphs <strong>2-3 sentences</strong> — AI extracts from concise blocks, not walls of text.</span>
            </li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Types</h3>
          <div className="space-y-3 text-xs text-gray-600">
            <div>
              <p className="font-medium text-gray-900">Article</p>
              <p>Best for awareness queries. Establishes expertise on a broad topic.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Comparison</p>
              <p>Best for evaluation queries. Directly addresses &quot;X vs Y&quot; searches.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">FAQ</p>
              <p>Highest citation rate. Schema-ready format AI models love to cite.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Landing Page</p>
              <p>Best for purchase queries. Conversion copy with clear CTAs.</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">After Publishing</h3>
          <p className="text-xs text-gray-600">
            Once you publish content, add the live URL in the content library below. Citari will automatically check if AI models are citing your published content during each scan.
          </p>
        </div>
      </div>
    </div>
  )
}
