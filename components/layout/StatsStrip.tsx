interface Stat {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
}

interface StatsStripProps {
  stats: Stat[]
}

export default function StatsStrip({ stats }: StatsStripProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl grid grid-cols-4 divide-x divide-gray-200">
      {stats.map((stat, i) => (
        <div key={i} className="px-6 py-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
          {stat.change && (
            <p
              className={`mt-1 text-xs font-medium ${
                stat.changeType === 'positive'
                  ? 'text-green-600'
                  : stat.changeType === 'negative'
                  ? 'text-red-600'
                  : 'text-gray-500'
              }`}
            >
              {stat.change}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
