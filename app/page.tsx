import Link from 'next/link'

const features = [
  {
    title: 'AI Visibility Monitoring',
    desc: 'Track how ChatGPT, Claude, and Gemini mention your brand across hundreds of prompts. Know your mention quality, position, and authority score.',
    tag: 'Core',
    color: 'bg-brand/10 text-brand',
    iconBg: 'bg-brand/10',
    icon: (
      <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    title: 'Competitor Intelligence',
    desc: 'See exactly who AI models recommend instead of you — and why. Threat cards, head-to-head comparisons, and predictive gap alerts.',
    tag: 'Strategy',
    color: 'bg-red-50 text-red-600',
    iconBg: 'bg-red-50',
    icon: (
      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    title: 'GEO Content Generator',
    desc: 'Claude writes AI-optimized articles, FAQs, and comparisons that get cited. Schedule and publish to WordPress, Webflow, HubSpot, Ghost, and Shopify.',
    tag: 'AI-Powered',
    color: 'bg-[#5DCAA5]/10 text-[#5DCAA5]',
    iconBg: 'bg-[#5DCAA5]/10',
    icon: (
      <svg className="w-6 h-6 text-[#5DCAA5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    title: 'Schema Markup Generator',
    desc: 'Generate valid JSON-LD that AI models love to cite. FAQ, Organization, LocalBusiness schema — with a site-wide audit and health score.',
    tag: 'Technical',
    color: 'bg-amber-50 text-amber-600',
    iconBg: 'bg-amber-50',
    icon: (
      <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: 'Consultant Playbook',
    desc: 'Track every action and its impact over time. Generate data-backed proposal language from your actual results. Your proprietary effectiveness data.',
    tag: 'Unique',
    color: 'bg-purple-50 text-purple-600',
    iconBg: 'bg-purple-50',
    icon: (
      <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: 'Google My Business Intel',
    desc: 'Review monitoring, NAP consistency tracking, and local AI visibility analysis. Know exactly why AI models recommend your competitors locally.',
    tag: 'Local',
    color: 'bg-blue-50 text-blue-600',
    iconBg: 'bg-blue-50',
    icon: (
      <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
]

const industries = ['Law Firms', 'Home Services', 'SaaS', 'Restaurants', 'Healthcare', 'Real Estate', 'E-commerce', 'Agencies', 'Finance', 'Consulting']

const plans = [
  { name: 'Starter', price: 39, desc: '2 clients · 50 prompts', features: ['Daily AI scans across 3 models', 'GEO content generator', 'Schema markup generator', 'Email drop alerts', 'Basic reports'] },
  { name: 'Professional', price: 89, desc: '10 clients · 500 prompts', features: ['Everything in Starter', 'White-label client portal', 'Consultant mode alerts', 'All CMS integrations', 'Competitive briefs', 'Predictive gap alerts', 'Content scheduler'], popular: true },
  { name: 'Agency', price: 199, desc: 'Unlimited everything', features: ['Everything in Professional', 'Consultant playbook', 'Cross-client benchmarks', 'Multilingual tracking', 'PR brief generator', 'Priority support', 'Custom branding'] },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-[#0F0A1A] border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Citari</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-white transition-colors">Log in</Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* HERO — Dark */}
      <section className="bg-[#0F0A1A] pt-20 pb-10 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-xs font-semibold text-brand mb-6">
            <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
            AI Visibility Intelligence
          </span>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight">
            Most tools give you a dashboard.<br />
            <span className="text-brand">Citari gives you a strategist.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Track your brand across every AI model. See what competitors are doing.
            Get the exact content to close the gap — and publish it automatically.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="px-7 py-3.5 text-base font-semibold text-white bg-brand rounded-xl hover:bg-brand-dark transition-colors shadow-lg shadow-brand/25">
              Start your 14-day free trial
            </Link>
            <span className="text-sm text-gray-500">No credit card required</span>
          </div>
        </div>

        {/* Browser Mockup */}
        <div className="hidden sm:block max-w-4xl mx-auto mt-16">
          <div className="bg-[#1a1030] rounded-xl border border-white/10 shadow-2xl shadow-brand/10 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#120d20] border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 mx-4 px-3 py-1 bg-white/5 rounded text-xs text-gray-500 font-mono">citari.app/overview</div>
            </div>
            {/* Dashboard content */}
            <div className="p-6 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'AI Visibility Score', value: '34%', color: 'text-brand' },
                  { label: 'Authority Score', value: '62/100', color: 'text-[#5DCAA5]' },
                  { label: 'Competitor Gaps', value: '14', color: 'text-red-400' },
                  { label: 'Share of Voice', value: '28%', color: 'text-amber-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-white/5 rounded-lg px-4 py-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {/* Platform bars */}
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Platform Mention Rates</p>
                {[
                  { name: 'ChatGPT', pct: 42, color: '#10A37F' },
                  { name: 'Claude', pct: 38, color: '#D97757' },
                  { name: 'Gemini', pct: 22, color: '#4285F4' },
                ].map((p) => (
                  <div key={p.name} className="flex items-center gap-3 mb-2 last:mb-0">
                    <span className="text-xs text-gray-400 w-16">{p.name}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-300 w-8 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
              {/* Prompt table */}
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Tracking Prompts</p>
                {[
                  { prompt: 'Best project management tools for agencies', dots: ['green', 'green', 'red'] },
                  { prompt: 'What CRM should a small business use', dots: ['amber', 'red', 'green'] },
                  { prompt: 'Top marketing automation platforms 2025', dots: ['red', 'green', 'amber'] },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-t border-white/5 first:border-t-0">
                    <span className="text-xs text-gray-400 flex-1 truncate">{r.prompt}</span>
                    <div className="flex gap-2">
                      {r.dots.map((d, j) => (
                        <span key={j} className={`w-2.5 h-2.5 rounded-full ${
                          d === 'green' ? 'bg-green-500' : d === 'amber' ? 'bg-amber-500' : 'bg-red-400'
                        }`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Models strip */}
      <section className="py-12 px-6 bg-[#0F0A1A] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-500 mb-5">Tracks visibility across every major AI model</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot'].map((m) => (
              <span key={m} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300">{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6 bg-[#F9FAFB]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">AI is the new search.<br />Is your brand showing up?</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-12">When someone asks an AI model for the best solution in your category, your competitors might be the answer — not you.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { stat: '67%', label: 'of buying decisions now start with an AI model query' },
              { stat: '3x', label: 'more likely to be cited with proper schema markup deployed' },
              { stat: '89%', label: 'of businesses have zero AI visibility tracking in place' },
            ].map((s) => (
              <div key={s.stat} className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-4xl font-bold text-brand">{s.stat}</p>
                <p className="text-sm text-gray-500 mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900">Not a dashboard. A strategist.</h2>
            <p className="text-lg text-gray-500 mt-3">Every feature is about prescribing action, not just measuring metrics.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:shadow-brand/5 transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center flex-shrink-0`}>
                    {f.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${f.color}`}>{f.tag}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries — Dark */}
      <section className="py-20 px-6 bg-[#0F0A1A]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">If buyers search for it, Citari tracks it.</h2>
          <p className="text-gray-500 mb-8">Works for any business in any industry.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((ind) => (
              <span key={ind} className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300 hover:bg-brand/10 hover:border-brand/30 hover:text-brand transition-colors">{ind}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900">Simple, transparent pricing</h2>
            <p className="text-gray-500 mt-3">14-day free trial on all plans. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {plans.map((plan: any) => (
              <div key={plan.name} className={`bg-white rounded-2xl p-7 flex flex-col ${plan.popular ? 'border-2 border-brand ring-4 ring-brand/10 relative' : 'border border-gray-200'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] font-bold text-white bg-brand rounded-full uppercase tracking-wider">Most Popular</span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-400">/mo</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">{plan.desc}</p>
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-[#5DCAA5] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`block w-full mt-7 py-3.5 text-center text-sm font-semibold rounded-xl transition-colors ${plan.popular ? 'bg-brand text-white hover:bg-brand-dark shadow-lg shadow-brand/25' : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'}`}>
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-brand">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">Start tracking your AI visibility today</h2>
          <p className="text-white/70 text-lg mb-8">14-day free trial. No credit card. Cancel anytime.</p>
          <Link href="/signup" className="inline-block px-8 py-4 text-brand font-bold bg-white rounded-xl hover:bg-gray-100 transition-colors shadow-lg text-base">
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-[#0F0A1A]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">Citari</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-300">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-500 hover:text-gray-300">Terms</Link>
            <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300">Log in</Link>
          </div>
          <p className="text-xs text-gray-600">&copy; 2026 OrangeCore Group · citari.app</p>
        </div>
      </footer>
    </div>
  )
}
