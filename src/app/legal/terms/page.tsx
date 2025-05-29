import { Navbar } from '@/components/navigation/navbar'

export const metadata = {
  title: 'Terms of Service - Fine Photo Gen',
  description: 'Terms of service for Fine Photo Gen AI image generation service'
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Description</h2>
              <p>Fine Photo Gen provides AI-powered image generation and personalization services through web-based and API access.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Account Registration</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must provide accurate information</li>
                <li>You&apos;re responsible for account security</li>
                <li>One account per person</li>
                <li>You must be 13+ years old (18+ for commercial use)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Subscription and Billing</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Payment Terms:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Subscriptions billed monthly/annually</li>
                <li>Processed through Stripe</li>
                <li>Auto-renewal unless cancelled</li>
                <li>No refunds for partial months</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Credits and Usage:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Credits reset monthly, don&apos;t roll over</li>
                <li>Usage subject to plan limits</li>
                <li>Overage may result in service suspension</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptable Use</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">You MAY:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Generate images for personal and commercial use (paid plans)</li>
                <li>Upload photos of yourself for model training</li>
                <li>Share generated images with proper attribution</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">You MAY NOT:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Upload images of other people without consent</li>
                <li>Generate inappropriate, illegal, or harmful content</li>
                <li>Violate intellectual property rights</li>
                <li>Attempt to reverse-engineer our AI models</li>
                <li>Use automated tools to exceed rate limits</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Your Content:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>You retain ownership of uploaded photos</li>
                <li>You grant us license to process and train models</li>
                <li>Generated images: You own rights based on your plan</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Our Service:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>We own the platform, AI models, and technology</li>
                <li>You receive a license to use our service</li>
                <li>Our trademarks and copyrights are protected</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Content Policy</h2>
              <p className="mb-4"><strong>Prohibited Content:</strong></p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Nudity, sexual, or adult content</li>
                <li>Violence, hate speech, or harassment</li>
                <li>Illegal activities or substances</li>
                <li>Copyrighted material without permission</li>
                <li>Deepfakes or misleading content</li>
                <li>Content involving minors</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Availability</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Services provided &quot;as-is&quot;</li>
                <li>No guarantee of 100% uptime</li>
                <li>Maintenance windows with notice</li>
                <li>Right to suspend accounts for violations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
              <p>Our liability is limited to the amount you&apos;ve paid in the past 12 months. We&apos;re not liable for indirect, consequential, or punitive damages.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
              <p className="mb-4">We may terminate your account for:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Terms of service violations</li>
                <li>Illegal activities</li>
                <li>Chargebacks or payment issues</li>
                <li>Inactive accounts (after notice)</li>
              </ul>

              <p className="mb-4">Upon termination:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access immediately revoked</li>
                <li>Generated images remain available for 30 days</li>
                <li>No refund for unused credits</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p>If you have questions about these Terms of Service, please contact us at: <a href="mailto:theinnotivehype@gmail.com" className="text-blue-600 hover:text-blue-800">theinnotivehype@gmail.com</a></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 