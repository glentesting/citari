interface PlatformData {
  name: string
  mentionRate: number
  color: string
}

interface PlatformBarsProps {
  platforms: PlatformData[]
}

export default function PlatformBars({ platforms }: PlatformBarsProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-[2.5px] h-4 bg-brand rounded-full" />
        AI Platform Mention Rates
      </h3>
      <div className="space-y-4">
        {platforms.map((platform) => (
          <div key={platform.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700">{platform.name}</span>
              <span className="text-sm font-semibold text-gray-900">{platform.mentionRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${platform.mentionRate}%`,
                  backgroundColor: platform.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
