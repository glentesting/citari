'use client'

interface PromptComparison {
  promptText: string
  clientMentioned: boolean
  competitorResults: {
    name: string
    mentioned: boolean
  }[]
}

interface HeadToHeadProps {
  comparisons: PromptComparison[]
  clientName: string
}

function Dot({ mentioned }: { mentioned: boolean }) {
  return (
    <span
      className={`w-3 h-3 rounded-full ${mentioned ? 'bg-green-500' : 'bg-red-400'}`}
      title={mentioned ? 'Mentioned' : 'Not mentioned'}
    />
  )
}

export default function HeadToHead({ comparisons, clientName }: HeadToHeadProps) {
  if (comparisons.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">Run a scan to see head-to-head prompt comparisons.</p>
      </div>
    )
  }

  // Get all unique competitor names
  const competitorNames = [
    ...new Set(comparisons.flatMap((c) => c.competitorResults.map((r) => r.name))),
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="grid border-b border-gray-200 bg-gray-50"
        style={{
          gridTemplateColumns: `1fr 80px ${competitorNames.map(() => '80px').join(' ')}`,
        }}
      >
        <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Prompt
        </div>
        <div className="px-4 py-3 text-xs font-semibold text-brand uppercase tracking-wide text-center">
          {clientName}
        </div>
        {competitorNames.map((name) => (
          <div key={name} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center truncate">
            {name}
          </div>
        ))}
      </div>

      {/* Rows */}
      {comparisons.map((comp, i) => {
        const clientLosing = !comp.clientMentioned &&
          comp.competitorResults.some((r) => r.mentioned)

        return (
          <div
            key={i}
            className={`grid border-b border-gray-100 last:border-b-0 ${
              clientLosing ? 'bg-[#FFF8F8]' : ''
            }`}
            style={{
              gridTemplateColumns: `1fr 80px ${competitorNames.map(() => '80px').join(' ')}`,
            }}
          >
            <div className="px-4 py-3 text-sm text-gray-900 flex items-center">
              <span className="line-clamp-2">{comp.promptText}</span>
            </div>
            <div className="px-4 py-3 flex items-center justify-center">
              <Dot mentioned={comp.clientMentioned} />
            </div>
            {competitorNames.map((name) => {
              const result = comp.competitorResults.find((r) => r.name === name)
              return (
                <div key={name} className="px-4 py-3 flex items-center justify-center">
                  <Dot mentioned={result?.mentioned ?? false} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
