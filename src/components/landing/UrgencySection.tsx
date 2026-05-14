import { Timer, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function UrgencySection() {
  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-white/20 rounded-full p-3">
              <Timer className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Launch Special: 50% Off Creator Plan
              </h3>
              <p className="text-white/90 text-lg">
                First month at half price. 500 credits, 3 personalized models.
                Offer ends soon.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="lg"
            className="bg-white text-orange-600 hover:bg-orange-50 font-bold px-8 shadow-xl whitespace-nowrap"
          >
            <Link href="/register?plan=creator">
              Claim Offer <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
