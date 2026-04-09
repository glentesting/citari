import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#5DCAA5" fillOpacity="0.75" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.95" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">Citari</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-gray prose-sm">
        <h1>Privacy Policy</h1>
        <p><em>Last updated: April 9, 2026</em></p>

        <h2>1. Introduction</h2>
        <p>OrangeCore Group (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates Citari (citari.app). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>

        <h2>2. Information We Collect</h2>
        <h3>Account Information</h3>
        <p>When you create an account, we collect your email address, name, company name, and role. This data is stored in Supabase (our database provider) with row-level security.</p>

        <h3>Client and Business Data</h3>
        <p>You provide client names, domains, industries, competitor information, and tracking prompts. This data is used solely to provide the Service and is never shared with other users or third parties.</p>

        <h3>AI Scan Data</h3>
        <p>When you run AI visibility scans, we send prompts to OpenAI (ChatGPT), Anthropic (Claude), and Google (Gemini) APIs. The responses are analyzed and stored as scan results. We store excerpts of AI responses (first 500 characters) for analysis purposes.</p>

        <h3>Payment Information</h3>
        <p>Payment processing is handled by Stripe. We do not store credit card numbers. Stripe retains payment information in accordance with their privacy policy.</p>

        <h3>Usage Data</h3>
        <p>We automatically collect standard web analytics: pages visited, features used, and session duration. We use this to improve the Service.</p>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain the Service</li>
          <li>To generate AI visibility reports and analytics</li>
          <li>To send email alerts about visibility changes (configurable)</li>
          <li>To send weekly digest emails (opt-out available)</li>
          <li>To process payments via Stripe</li>
          <li>To calculate anonymous industry benchmarks (aggregated, never individual)</li>
          <li>To improve the Service</li>
        </ul>

        <h2>4. Data Sharing</h2>
        <p>We share data only with:</p>
        <ul>
          <li><strong>Supabase</strong> — database hosting and authentication</li>
          <li><strong>Vercel</strong> — application hosting</li>
          <li><strong>Stripe</strong> — payment processing</li>
          <li><strong>Resend</strong> — transactional email delivery</li>
          <li><strong>AI Model Providers</strong> (OpenAI, Anthropic, Google) — prompt text is sent for scanning; responses are processed and stored</li>
          <li><strong>Serper.dev</strong> — keyword ranking data</li>
        </ul>
        <p>We do not sell your data. We do not share individual client data with other Citari users. Industry benchmark data is aggregated and anonymized (minimum 5 businesses per industry).</p>

        <h2>5. White-Label Client Portals</h2>
        <p>If you create a client portal, the portal displays read-only visibility data for that specific client. Portal access is password-protected. Only the data you choose to share through the portal is visible to your clients.</p>

        <h2>6. Data Security</h2>
        <p>We implement appropriate security measures including: encrypted data transmission (TLS), row-level security in our database, secure credential storage, and regular security reviews. Supabase Service Role keys are server-side only and never exposed to clients.</p>

        <h2>7. Data Retention</h2>
        <p>Your data is retained as long as your account is active. Upon account deletion, all associated data (clients, prompts, scan results, content, reports) is permanently deleted within 30 days. You may request data export at any time.</p>

        <h2>8. Your Rights</h2>
        <p>You have the right to: (a) access your data; (b) correct inaccurate data; (c) delete your account and all data; (d) export your data; (e) opt out of marketing emails; (f) configure or disable alert notifications.</p>

        <h2>9. Cookies</h2>
        <p>We use essential cookies for authentication (Supabase session tokens). We do not use third-party advertising or tracking cookies.</p>

        <h2>10. Children&apos;s Privacy</h2>
        <p>The Service is not intended for individuals under 18. We do not knowingly collect data from minors.</p>

        <h2>11. International Data</h2>
        <p>Your data may be processed in the United States where our servers are located. By using the Service, you consent to this transfer.</p>

        <h2>12. Changes to This Policy</h2>
        <p>We may update this policy from time to time. We will notify you of material changes via email at least 14 days before they take effect.</p>

        <h2>13. Contact</h2>
        <p>Questions about this policy? Contact us at privacy@citari.app.</p>
      </div>
    </div>
  )
}
