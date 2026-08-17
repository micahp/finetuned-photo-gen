import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { PRICING_PLANS } from '@/lib/stripe/pricing'
import { Navbar } from '@/components/navigation/navbar'
import { Footer } from '@/components/navigation/footer'
import { HeroCarousel } from '@/components/landing/HeroCarousel'
import { DemoLibrarySection } from '@/components/landing/DemoLibrarySection'
import { SelfieTrainingSection } from '@/components/landing/SelfieTrainingSection'
import { FilmStudioSection } from '@/components/landing/FilmStudioSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { TrustSignalsSection } from '@/components/landing/TrustSignalsSection'
import { UrgencySection } from '@/components/landing/UrgencySection'
import { PhotoPackSection } from '@/components/landing/PhotoPackSection'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function HomePage() {
  const outputImages = ['/selfies/generated.jpeg', '/selfies/generated-2.png']
  const randomIndex = Math.floor(Math.random() * outputImages.length)
  const randomOutputImage = outputImages[randomIndex]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />

      {/* Hero Carousel */}
      <HeroCarousel
        videos={[
          {
            id: 'video1',
            sources: [{ url: '/videos/seedance_pro_t2v.mp4', type: 'video/mp4' }],
            thumbnail: '/thumbnails/seedance_pro_t2v-thumb.jpg',
            title: 'Seedance Pro',
            description: 'A bright blue race car speeds along a snowy racetrack...',
            fullPrompt: 'A bright blue race car speeds along a snowy racetrack. [Low-angle shot] Captures several cars speeding along the racetrack through a harsh snowstorm. [Overhead shot] The camera gradually pulls upward, revealing the full race scene illuminated by storm lights',
            lowQualityPlaceholder: '/selfies/wan-i2v-thumb.jpg'
          },
          {
            id: 'video2',
            sources: [{ url: '/videos/director.mp4', type: 'video/mp4' }],
            thumbnail: '/thumbnails/director-thumb.jpg',
            title: 'Hailuo 2 w/ Camera Control Prompt',
            description: '[Push in]Close up of a tense woman looks to the left, startled by a sound...',
            fullPrompt: "[Push in]Close up of a tense woman looks to the left, startled by a sound, in a darkened kitchen, Pots and pans hang ominously, the window in the kitchen is open and the wind softly blows the pans and creates an ominous mood. [Shake]the woman's shock turns to fear. Black-and-white film noir shot dimly lit, 1950s-style, with dramatic, high-contrast shadows. The overall atmosphere is reminiscent of Alfred Hitchcock's suspenseful storytelling, evoking a looming sense of dread with stark chiaroscuro lighting and a slight film-grain texture.",
          },
          {
            id: 'video3',
            sources: [{ url: '/videos/video3.mp4', type: 'video/mp4' }],
            thumbnail: '/thumbnails/video3-thumb.jpg',
            title: 'Hailuo 2',
            description: 'A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat...',
            fullPrompt: "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them.",
            lowQualityPlaceholder: '/selfies/framepack-thumb.jpg'
          }
        ]}
        autoplayInterval={5000}
        pauseOnHover={false}
        enableAutoplay={true}
        enableAdaptiveQuality={true}
        preloadStrategy="metadata"
        ariaLabel="Hero Carousel"
      />

      {/* Urgency Banner */}
      <UrgencySection />

      {/* Selfie Training Example */}
      <SelfieTrainingSection
        inputImageUrls={[
          '/selfies/IMG_1248.jpg',
          '/selfies/IMG_1889.jpg',
          '/selfies/IMG_2268.jpg',
          '/selfies/IMG_3157.jpg',
        ]}
        outputImageUrl={randomOutputImage}
      />

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <CardTitle>Upload Your Photos</CardTitle>
              <CardDescription>
                Upload 10-20 high-quality photos of yourself to train your personalized AI model
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <CardTitle>Train Your Model</CardTitle>
              <CardDescription>
                Our AI analyzes your photos and creates a custom FLUX model that understands your unique features
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <CardTitle>Generate Images</CardTitle>
              <CardDescription>
                Create personalized images with custom prompts - from professional headshots to creative art
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* AI Film Studio Section */}
      <FilmStudioSection />

      {/* Demo Library Section */}
      <DemoLibrarySection />

      {/* Social Proof — Testimonials */}
      <TestimonialsSection />

      {/* Trust Signals */}
      <TrustSignalsSection />

      {/* Pricing Plans */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">
          Start free and upgrade when you need more power. All plans include access to our full
          suite of AI tools.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {PRICING_PLANS.map((plan, index) => (
            <Card
              key={plan.id}
              className={`relative ${index === 1 ? 'border-brand-blue border-2 shadow-lg' : ''}`}
            >
              {index === 1 && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-brand-blue text-white">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {plan.id !== 'free' && (
                  <div className="text-3xl font-bold">
                    ${plan.price}
                    <span className="text-base font-normal text-gray-500">/mo</span>
                  </div>
                )}
                <div className="text-lg font-semibold text-brand-blue mt-1">
                  {plan.credits.toLocaleString()} credits
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full ${index === 1 ? 'bg-brand-blue hover:bg-blue-700' : ''}`}
                  variant={index === 1 ? 'default' : 'outline'}
                >
                  <Link href="/register">
                    {plan.buttonText} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* One-Time Credit Packs */}
      <PhotoPackSection />

      {/* Newsletter CTA Section */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <Sparkles className="h-12 w-12 mx-auto mb-6 text-brand-blue" />
          <h2 className="text-3xl font-bold mb-4">
            Get AI Tips, Tools & Exclusive Deals
          </h2>
          <p className="text-xl mb-8 text-gray-300 max-w-xl mx-auto">
            Join the Innovative Hype newsletter. Weekly insights on AI creativity, new feature
            drops, and subscriber-only discounts.
          </p>
          <NewsletterSignup
            source="landing_page"
            variant="hero"
            placeholder="you@email.com"
            buttonText="Join Free"
          />
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-brand-blue via-brand-purple to-brand-cyan text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Create Your AI Persona?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of creators generating unique, personalized content with AI
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="px-8 font-semibold">
              <Link href="/register">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8 text-white border-white/30 hover:bg-white/10">
              <Link href="/dashboard/generate">
                See Examples <Sparkles className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
