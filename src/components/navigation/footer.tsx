import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Fine Photo Gen</h3>
            <p className="text-gray-300 text-sm">
              Create personalized AI images with custom FLUX models trained on your photos.
            </p>
            <div className="flex space-x-4">
              <span className="text-xs text-gray-400">© 2024 Innovative Hype LLC</span>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link href="/dashboard/generate" className="hover:text-white transition-colors">Generate Images</Link></li>
              <li><Link href="/dashboard/models" className="hover:text-white transition-colors">My Models</Link></li>
              <li><Link href="/dashboard/gallery" className="hover:text-white transition-colors">Gallery</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold">Support</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link href="/dashboard/billing" className="hover:text-white transition-colors">Billing</Link></li>
              <li><Link href="/dashboard/settings" className="hover:text-white transition-colors">Account Settings</Link></li>
              <li><a href="mailto:theinnotivehype@gmail.com" className="hover:text-white transition-colors">Contact Support</a></li>
              <li><a href="mailto:theinnotivehype@gmail.com" className="hover:text-white transition-colors">DMCA Requests</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/terms-of-use" className="hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link href="/legal/dmca" className="hover:text-white transition-colors">DMCA Policy</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-400">
              Built with AI ethics and user privacy in mind
            </div>
            <div className="flex space-x-6 text-sm text-gray-300">
              <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/legal/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/legal/cookies" className="hover:text-white transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 