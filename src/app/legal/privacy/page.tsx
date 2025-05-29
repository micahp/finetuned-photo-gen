import { Navbar } from '@/components/navigation/navbar'

export const metadata = {
  title: 'Privacy Policy - Fine Photo Gen',
  description: 'Privacy policy for Fine Photo Gen AI image generation service'
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Personal Information:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>Account information (name, email, password)</li>
                <li>Payment information (processed by Stripe)</li>
                <li>Profile photos and training images you upload</li>
                <li>Generated images and model data</li>
                <li>Usage analytics and app interactions</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Automatically Collected:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>IP address, browser type, device information</li>
                <li>Cookies and similar tracking technologies</li>
                <li>Usage patterns and feature interactions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Service Delivery:</strong> Process AI image generations and model training</li>
                <li><strong>Account Management:</strong> Maintain your account and subscription</li>
                <li><strong>Payment Processing:</strong> Handle billing through Stripe (we don&apos;t store payment details)</li>
                <li><strong>Communication:</strong> Send service updates and support responses</li>
                <li><strong>Improvement:</strong> Analyze usage to improve our services</li>
                <li><strong>Legal Compliance:</strong> Meet legal obligations and enforce our terms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information Sharing</h2>
              <p className="mb-4">We share your information with:</p>
              <ul className="list-disc pl-6 mb-4 space-y-1">
                <li>AI Service Providers (Together.AI, Replicate) for image processing</li>
                <li>Payment Processors (Stripe) for billing</li>
                <li>Cloud Services (Vercel, Cloudflare) for hosting and storage</li>
                <li>Legal Requirements when required by law</li>
              </ul>

              <p className="font-semibold text-gray-900 mb-2">We DO NOT:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Sell your personal information</li>
                <li>Share your images publicly without permission</li>
                <li>Use your images to train other users&apos; models</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Images stored on Cloudflare R2 with encryption</li>
                <li>Database hosted on secure cloud infrastructure</li>
                <li>Industry-standard security measures</li>
                <li>Regular security audits and updates</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Access:</strong> Request copies of your data</li>
                <li><strong>Correction:</strong> Update incorrect information</li>
                <li><strong>Deletion:</strong> Request account and data deletion</li>
                <li><strong>Portability:</strong> Export your generated images</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing emails</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">International Users</h2>
              <p>Our services are hosted in the US. By using our service, you consent to data transfer and processing in these jurisdictions.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children&apos;s Privacy</h2>
              <p>Our service is not intended for users under 13. We do not knowingly collect information from children under 13.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p>If you have questions about this Privacy Policy, please contact us at: <a href="mailto:theinnotivehype@gmail.com" className="text-blue-600 hover:text-blue-800">theinnotivehype@gmail.com</a></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
} 