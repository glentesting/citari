'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useClient } from '@/hooks/useClient'

interface BenchmarkData {
  avgVisibilityScore: number
  avgAuthorityScore: number
  avgGapCount: number
  topContentType: string | null
  sampleSize: number
}

interface BenchmarkComparisonProps {
  clientVisibility: number
  clientAuthority: number | null
}

export default function BenchmarkComparison({ clientVisibility, clientAuthority }: BenchmarkComparisonProps) {
  const { activeClient } = useClient()
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!activeClient?.industry) return

      const { data } = await supabase
        .from('category_benchmarks')
        .select('value, sample_size')
        .eq('industry', activeClient.industry.toLowerCase().trim())
        .eq('metric', 'monthly_summary')
        .single()

      if (data?.value) {
        setBenchmark({
          ...(data.value as any),
          sampleSize: data.sample_size || 0,
        })
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient])

  if (!benchmark || !activeClient?.industry) return null

  const visDiff = clientVisibility - benchmark.avgVisibilityScore
  const authDiff = clientAuthority != null ? clientAuthority - benchmark.avgAuthorityScore : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <span className="w-[2.5px] h-4 bg-brand rounded-full" />
        Industry Benchmark
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        How you compare to other <span className="font-medium">{activeClient.industry}</span> businesses tracked by Citari
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Your Visibility</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900">{clientVisibility}%</span>
            <span className={`text-xs font-medium ${visDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {visDiff >= 0 ? '+' : ''}{visDiff}% vs avg
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Category avg: {benchmark.avgVisibilityScore}%</p>
        </div>

        {clientAuthority != null && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Your Authority</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-gray-900">{clientAuthority}/100</span>
              {authDiff != null && (
                <span className={`text-xs font-medium ${authDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {authDiff >= 0 ? '+' : ''}{authDiff} vs avg
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Category avg: {benchmark.avgAuthorityScore}/100</p>
          </div>
        )}
      </div>

      {benchmark.topContentType && (
        <p className="text-xs text-gray-500 mt-3">
          Top performers in your category publish <span className="font-medium">{benchmark.topContentType}</span> content most frequently.
        </p>
      )}

      <p className="text-[10px] text-gray-300 mt-2">
        Based on {benchmark.sampleSize} businesses in {activeClient.industry}
      </p>
    </div>
  )
}
