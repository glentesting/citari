interface Gap {
  promptText: string
  competitorsMentioned: string[]
}

interface CompetitorGapListProps {
  gaps: Gap[]
}

export default function CompetitorGapList({ gaps }: CompetitorGapListProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-[2.5px] h-4 bg-brand rounded-full" />
        Top Competitor Gaps
      </h3>

      {gaps.length === 0 ? (
        <p className="text-sm text-gray-400">No competitor gaps detected yet.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {gaps.map((gap, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-[#FFF8F8] border border-red-100"
            >
              <span className="text-xs font-bold text-red-400 mt-0.5">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm text-gray-900 line-clamp-2">{gap.promptText}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Competitors mentioned: {gap.competitorsMentioned.join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
