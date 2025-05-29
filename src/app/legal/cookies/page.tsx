import { Navbar } from '@/components/navigation/navbar'

export const metadata = {
  title: 'Cookie Policy - Fine Photo Gen',
  description: 'Cookie policy for Fine Photo Gen AI image generation service'
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Cookie Policy</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Are Cookies</h2>
              <p>
                Cookies are small text files that are stored on your device when you visit our website. 
                They help us provide you with a better experience by remembering your preferences and analyzing how you use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Cookies</h2>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Essential Cookies</h3>
              <p className="mb-4">These cookies are necessary for the website to function properly:</p>
              <ul className="list-disc pl-6 mb-6 space-y-1">
                <li><strong>Authentication:</strong> Keep you logged in to your account</li>
                <li><strong>Security:</strong> Protect against cross-site request forgery</li>
                <li><strong>Session Management:</strong> Maintain your session across pages</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Functional Cookies</h3>
              <p className="mb-4">These cookies enhance your experience:</p>
              <ul className="list-disc pl-6 mb-6 space-y-1">
                <li><strong>Preferences:</strong> Remember your settings and preferences</li>
                <li><strong>Language:</strong> Remember your language selection</li>
                <li><strong>Theme:</strong> Remember your UI preferences</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Analytics Cookies</h3>
              <p className="mb-4">These cookies help us understand how you use our service:</p>
              <ul className="list-disc pl-6 mb-6 space-y-1">
                <li><strong>Usage Analytics:</strong> Track how you interact with our features</li>
                <li><strong>Performance:</strong> Monitor website performance and errors</li>
                <li><strong>A/B Testing:</strong> Test different versions of our interface</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Third-Party Cookies</h3>
              <p className="mb-4">We may use cookies from trusted third-party services:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Stripe:</strong> For payment processing</li>
                <li><strong>Vercel:</strong> For hosting and analytics</li>
                <li><strong>Cloudflare:</strong> For security and performance</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Managing Cookies</h2>
              <p className="mb-4">You can control and manage cookies in several ways:</p>
              
              <h3 className="text-xl font-medium text-gray-800 mb-3">Browser Settings</h3>
              <p className="mb-4">Most browsers allow you to:</p>
              <ul className="list-disc pl-6 mb-6 space-y-1">
                <li>View and delete cookies</li>
                <li>Block cookies from specific sites</li>
                <li>Block third-party cookies</li>
                <li>Clear all cookies when you close the browser</li>
              </ul>

              <h3 className="text-xl font-medium text-gray-800 mb-3">Our Cookie Preferences</h3>
              <p className="mb-4">
                You can manage your cookie preferences through our cookie banner when you first visit the site, 
                or by updating your preferences in your account settings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookie Retention</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                <li><strong>Persistent Cookies:</strong> Remain until expiry date or manual deletion</li>
                <li><strong>Authentication Cookies:</strong> Typically expire after 30 days</li>
                <li><strong>Preference Cookies:</strong> Remain for up to 1 year</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Impact of Disabling Cookies</h2>
              <p className="mb-4">If you disable cookies, you may experience:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Difficulty staying logged in</li>
                <li>Loss of personalized settings</li>
                <li>Reduced functionality of certain features</li>
                <li>Need to re-enter information frequently</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p>
                If you have questions about our use of cookies, please contact us at: 
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