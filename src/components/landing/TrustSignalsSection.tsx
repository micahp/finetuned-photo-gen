import { Shield, Lock, Zap, BadgeCheck } from 'lucide-react'

export function TrustSignalsSection() {
  return (
    <div className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Featured in */}
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-6">
            Trusted by creators at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-50">
            {['Substack', 'YouTube', 'Instagram', 'TikTok', 'Product Hunt'].map((brand) => (
              <span key={brand} className="text-xl font-bold text-gray-400">
                {brand}
              </span>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: <Shield className="h-8 w-8 text-brand-blue" />,
              title: 'Enterprise Security',
              description: 'SOC 2 compliant with AES-256 encryption at rest and in transit.',
            },
            {
              icon: <Lock className="h-8 w-8 text-brand-blue" />,
              title: 'Privacy First',
              description: 'Your photos are yours. We never use your data for training public models.',
            },
            {
              icon: <Zap className="h-8 w-8 text-brand-blue" />,
              title: 'Lightning Fast',
              description: 'Generate images in under 10 seconds with our optimized GPU infrastructure.',
            },
            {
              icon: <BadgeCheck className="h-8 w-8 text-brand-blue" />,
              title: 'Stripe Verified',
              description: 'All payments processed securely through Stripe. Your data is safe.',
            },
          ].map((item) => (
            <div key={item.title} className="text-center p-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 mb-4">
                {item.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
