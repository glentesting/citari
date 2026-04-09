interface ShareEntry {
  name: string
  share: number
  isClient: boolean
}

interface ShareOfVoiceProps {
  entries: ShareEntry[]
  clientShare: number
  industry?: string
}

export default function ShareOfVoice({ entries, clientShare, industry }: ShareOfVoiceProps) {
  // Colors: client gets brand violet, competitors get grays/reds
  const competitorColors = ['#EF4444', '#F97316', '#6B7280', '#9CA3AF', '#D1D5DB']

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <span className="w-[2.5px] h-4 bg-brand rounded-full" />
        AI Share of Voice
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        You own <span className="font-semibold text-brand">{clientShare}%</span> of AI share of voice
        {industry ? ` in ${industry}` : ''}.
      </p>

      {/* Stacked bar */}
      <div className="w-full h-8 bg-gray-100 rounded-lg overflow-hidden flex">
        {entries.map((entry, i) => {
          if (entry.share === 0) return null
          const color = entry.isClient ? '#7C3AED' : competitorColors[i] || '#D1D5DB'
          return (
            <div
              key={entry.name}
              className="h-full transition-all duration-500 relative group"
              style={{ width: `${entry.share}%`, backgroundColor: color }}
              title={`${entry.name}: ${entry.share}%`}
            >
              {entry.share >= 10 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                  {entry.share}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        {entries.map((entry, i) => {
          const color = entry.isClient ? '#7C3AED' : competitorColors[i] || '#D1D5DB'
          return (
            <div key={entry.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className={`text-sm ${entry.isClient ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {entry.name}
                  {entry.isClient && <span className="text-xs text-brand ml-1">(you)</span>}
                </span>
              </div>
              <span className={`text-sm font-semibold ${entry.isClient ? 'text-brand' : 'text-gray-900'}`}>
                {entry.share}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
