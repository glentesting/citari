import Link from 'next/link'

export default function TermsPage() {
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
        <h1>Terms of Service</h1>
        <p><em>Last updated: April 9, 2026</em></p>

        <h2>1. Agreement to Terms</h2>
        <p>By accessing or using Citari (&quot;the Service&quot;), operated by OrangeCore Group (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

        <h2>2. Description of Service</h2>
        <p>Citari is a competitive intelligence and AI visibility SaaS platform that tracks brand mentions across AI models, generates optimized content, and provides analytics and reporting tools for businesses and consultants.</p>

        <h2>3. Account Registration</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use the Service.</p>

        <h2>4. Subscription Plans and Billing</h2>
        <p>Citari offers paid subscription plans (Starter, Professional, Agency). All plans include a 14-day free trial. After the trial, you will be charged the applicable subscription fee. Subscriptions renew automatically unless cancelled before the renewal date. All fees are non-refundable except as required by law.</p>
        <p>We reserve the right to change pricing with 30 days notice to existing subscribers.</p>

        <h2>5. Acceptable Use</h2>
        <p>You agree not to: (a) use the Service for any illegal purpose; (b) attempt to reverse engineer, decompile, or disassemble the Service; (c) use automated systems to access the Service except through our provided APIs; (d) resell access to the Service without written permission; (e) use the Service to harass, spam, or harm others; (f) violate the terms of any third-party AI model accessed through the Service.</p>

        <h2>6. Content and Data</h2>
        <p>You retain ownership of all data you input into Citari. We do not claim ownership of your client data, prompts, or generated content. You grant us a limited license to process your data solely for the purpose of providing the Service.</p>
        <p>AI-generated content created through our AI Content Generator is yours to use commercially. We make no warranties about the accuracy or quality of AI-generated content.</p>

        <h2>7. Third-Party Integrations</h2>
        <p>The Service integrates with third-party APIs (OpenAI, Anthropic, Google, Stripe, Serper.dev, various CMS platforms). Your use of these services is subject to their respective terms. We are not responsible for third-party service outages or changes.</p>

        <h2>8. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CITARI AND ORANGECORE GROUP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM.</p>

        <h2>9. Disclaimer of Warranties</h2>
        <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT AI VISIBILITY SCORES WILL IMPROVE, THAT AI MODELS WILL CITE YOUR CONTENT, OR THAT ANY SPECIFIC BUSINESS OUTCOME WILL RESULT FROM USING THE SERVICE.</p>

        <h2>10. Termination</h2>
        <p>Either party may terminate at any time. Upon termination, your access to the Service will cease and your data will be deleted within 30 days. You may export your data before termination.</p>

        <h2>11. Changes to Terms</h2>
        <p>We may update these terms from time to time. We will notify you of material changes via email or in-app notification at least 14 days before they take effect.</p>

        <h2>12. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions.</p>

        <h2>13. Contact</h2>
        <p>Questions about these terms? Contact us at legal@citari.app.</p>
      </div>
    </div>
  )
}
