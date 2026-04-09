import Link from 'next/link'

const features = [
  { title: 'AI Visibility Monitoring', desc: 'Track how ChatGPT, Claude, and Gemini mention your brand across hundreds of prompts.' },
  { title: 'Competitor Intelligence', desc: 'See exactly who AI models recommend instead of you — and why.' },
  { title: 'GEO Content Generator', desc: 'Claude writes AI-optimized content that gets cited. FAQ, comparison, and landing pages.' },
  { title: 'Content Scheduler', desc: 'Schedule and publish to WordPress, Webflow, HubSpot, Ghost, and Shopify.' },
  { title: 'Schema Markup Generator', desc: 'Generate valid JSON-LD that AI models love to cite. FAQ, Organization, LocalBusiness.' },
  { title: 'Smart Reports', desc: 'AI-written executive narratives and white-label client portals.' },
  { title: 'Google My Business Intel', desc: 'Review monitoring, NAP consistency, and local AI visibility tracking.' },
  { title: 'What Would It Take Simulator', desc: 'Set a visibility goal. Get a specific, data-backed roadmap to reach it.' },
]

const industries = [
  'Law Firms', 'Home Services', 'SaaS', 'Restaurants', 'Healthcare',
  'Real Estate', 'E-commerce', 'Agencies', 'Local Services', 'Finance',
]

const plans = [
  { name: 'Starter', price: 39, desc: '2 clients · 50 prompts', features: ['Daily AI scans', 'Basic GEO content', 'Schema generator', 'Email alerts'], cta: 'Start Free Trial' },
  { name: 'Professional', price: 89, desc: '10 clients · 500 prompts', features: ['All Starter features', 'White-label client portal', 'Consultant mode', 'CMS integrations', 'Competitive briefs', 'Predictive alerts'], popular: true, cta: 'Start Free Trial' },
  { name: 'Agency', price: 199, desc: 'Unlimited clients & prompts', features: ['All Professional features', 'Consultant playbook', 'Cross-client benchmarks', 'Multilingual tracking', 'Priority support', 'Custom branding'], cta: 'Start Free Trial' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100">
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
            <span className="text-xl font-bold text-gray-900">Citari</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Log in</Link>
            <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            Most tools give you a dashboard.<br />
            <span className="text-brand">Citari gives you a strategist.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Track your brand across every AI model. See what competitors are doing. Get the exact content to close the gap — and publish it automatically.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup" className="px-6 py-3 text-base font-semibold text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors">Start your 14-day free trial</Link>
            <p className="text-sm text-gray-400">No credit card required</p>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#F9FAFB]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900">AI is the new search. Is your brand showing up?</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">67% of buying decisions now start with an AI model query. When someone asks ChatGPT for the best solution in your category, your competitors might be the answer — not you.</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Works for any business</h2>
          <p className="text-gray-500 mb-8">If buyers search for it, Citari tracks it.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((ind) => (
              <span key={ind} className="px-4 py-2 bg-brand-bg text-brand text-sm font-medium rounded-full border border-brand-border">{ind}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-[#F9FAFB]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Not a dashboard. A strategist.</h2>
          <div className="grid grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6" id="pricing">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">Simple, transparent pricing</h2>
          <p className="text-gray-500 text-center mb-12">14-day free trial on all plans. No credit card required.</p>
          <div className="grid grid-cols-3 gap-6">
            {plans.map((plan: any) => (
              <div key={plan.name} className={`bg-white border rounded-xl p-6 ${plan.popular ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}>
                {plan.popular && <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-white bg-brand rounded-full mb-3 uppercase tracking-wide">Most Popular</span>}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-bold text-gray-900">${plan.price}</span><span className="text-gray-500">/mo</span></div>
                <p className="text-sm text-gray-500 mt-1">{plan.desc}</p>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`block w-full mt-6 py-3 text-center text-sm font-semibold rounded-lg transition-colors ${plan.popular ? 'bg-brand text-white hover:bg-brand-dark' : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-brand">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start tracking your AI visibility today</h2>
          <p className="text-white/80 text-lg mb-8">14-day free trial. No credit card. Cancel anytime.</p>
          <Link href="/signup" className="inline-block px-8 py-3 text-brand font-semibold bg-white rounded-lg hover:bg-gray-100 transition-colors">Get Started Free</Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">Citari</span>
          </div>
          <p className="text-xs text-gray-400">Built by OrangeCore Group · citari.app</p>
        </div>
      </footer>
    </div>
  )
}
