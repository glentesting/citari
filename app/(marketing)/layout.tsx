import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Citari — Competitive Intelligence for the AI Era',
  description: 'Track your brand across ChatGPT, Claude, and Gemini. See what competitors are doing. Get the exact content to close the gap — and publish it automatically.',
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
