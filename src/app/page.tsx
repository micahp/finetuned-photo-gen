import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { PRICING_PLANS } from '@/lib/stripe/pricing'
import { Navbar } from '@/components/navigation/navbar'
import { Footer } from '@/components/navigation/footer'
import { DemoLibrarySection } from '@/components/landing/DemoLibrarySection'
import { SelfieTrainingSection } from '@/components/landing/SelfieTrainingSection'
import { FilmStudioSection } from '@/components/landing/FilmStudioSection'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="flex justify-center items-center mb-6">
            <Image src="/favicon-transparent.png" alt="Fine Photo Gen Logo" width={128} height={128} className="mr-4" />
            <h1 className="text-5xl font-bold text-gray-900">
              Fine Photo Gen
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Create personalized AI images by training custom FLUX models with your own photos. 
            Upload 10-20 images of yourself and generate unlimited unique, personalized content.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="px-8">
              <Link href="/register">
                Start Creating
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8">
              <Link href="/login">
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </div>

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
                Create unlimited personalized images with custom prompts - from professional headshots to creative art
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Selfie Training Example Section */}
      <SelfieTrainingSection />

      {/* AI Film Studio Section */}
      <FilmStudioSection />

      {/* Demo Library Section */}
      <DemoLibrarySection />

      {/* Pricing Preview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Simple Pricing
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {PRICING_PLANS.map((plan, index) => (
            <Card 
              key={plan.id} 
              className={`relative ${index === 1 ? 'border-blue-500 border-2 shadow-lg' : ''}`}
            >
              {index === 1 && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-brand-blue text-white">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {plan.credits} credits
                  {plan.id !== 'free' && (
                    <span className="text-sm text-gray-500">/month</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Perfect for {plan.id === 'free' ? 'trying out' : plan.id === 'starter' ? 'getting started' : plan.id === 'creator' ? 'regular use' : 'power users'}
                </p>
                <Button 
                  asChild 
                  className={`w-full ${index === 1 ? 'bg-brand-blue hover:bg-blue-700' : ''}`}
                  variant={index === 1 ? 'default' : 'outline'}
                >
                  <Link href="/register">
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-brand-blue via-brand-purple to-brand-cyan text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Create Personalized AI Images?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join hundreds of creators using AI to generate unique, personalized content
          </p>
          <Button asChild size="lg" variant="secondary" className="px-8">
            <Link href="/register">
              Start Free Trial
            </Link>
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  )
}
