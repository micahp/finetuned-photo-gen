import { Navbar } from '@/components/navigation/navbar'

export const metadata = {
  title: 'Terms of Use - Fine Photo Gen',
  description: 'Terms of use for Fine Photo Gen AI image generation service'
}

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Use</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">License to Use</h2>
              <p>
                We grant you a limited, non-exclusive, revocable license to use our service according to these terms and your subscription plan.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Comply with all applicable laws</li>
                <li>Respect others&apos; intellectual property</li>
                <li>Use reasonable bandwidth and resources</li>
                <li>Report violations or security issues</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Generated Image Rights</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Free Plan:</strong> Personal use only, with attribution</li>
                <li><strong>Paid Plans:</strong> Commercial use permitted without attribution</li>
                <li><strong>All Plans:</strong> No resale of raw generated images as stock photos</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Model Training</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Training uses only your uploaded photos</li>
                <li>Models are private to your account</li>
                <li>We may use aggregated, anonymized data for service improvement</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI Ethics and Safety</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Content Filtering:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Automated content moderation for harmful content</li>
                <li>Human review for reported violations</li>
                <li>Proactive bias detection and mitigation</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Consent and Identity:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Only upload photos of yourself or with explicit consent</li>
                <li>No creation of non-consensual intimate images</li>
                <li>No impersonation of public figures or celebrities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">API Usage (if applicable)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Rate limits apply per plan</li>
                <li>No automated abuse or scraping</li>
                <li>Maintain API key security</li>
                <li>Commercial use requires paid plan</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Platform Usage Guidelines</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Acceptable Use:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Creative and artistic expression</li>
                <li>Professional content creation</li>
                <li>Personal entertainment and exploration</li>
                <li>Educational and research purposes</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Prohibited Activities:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Generating misleading or false information</li>
                <li>Creating content that violates others&apos; rights</li>
                <li>Attempting to circumvent safety measures</li>
                <li>Using service for illegal activities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quality and Performance</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>AI-generated content quality may vary</li>
                <li>No guarantee of specific artistic outcomes</li>
                <li>Processing times depend on system load</li>
                <li>We strive for continuous improvement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p>
                If you have questions about these Terms of Use, please contact us at: 
                <a href="mailto:theinnotivehype@gmail.com" className="text-blue-600 hover:text-blue-800 ml-1">
                  theinnotivehype@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 