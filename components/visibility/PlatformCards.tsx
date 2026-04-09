'use client'

interface PlatformCardData {
  name: string
  mentionRate: number
  totalScans: number
  color: string
}

interface PlatformCardsProps {
  platforms: PlatformCardData[]
}

export default function PlatformCards({ platforms }: PlatformCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {platforms.map((p) => (
        <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-900">{p.name}</span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: p.color }}
            />
          </div>
          <p className="text-3xl font-bold text-gray-900">{p.mentionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">mention rate</p>
          <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${p.mentionRate}%`, backgroundColor: p.color }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{p.totalScans} scans</p>
        </div>
      ))}
    </div>
  )
}
