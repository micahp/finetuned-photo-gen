import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { PRICING_PLANS } from '@/lib/stripe/pricing'
import { Navbar } from '@/components/navigation/navbar'
import { Footer } from '@/components/navigation/footer'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />
      
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Fine Photo Gen
          </h1>
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

      {/* Pricing Preview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Simple Pricing
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {PRICING_PLANS.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-blue-500 border-2 shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="text-3xl font-bold">
                  ${plan.price}
                  {plan.price > 0 && <span className="text-sm text-gray-500">/month</span>}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>✓ {plan.credits} AI generations per month</li>
                  <li>✓ {plan.maxModels} personalized model{plan.maxModels !== 1 ? 's' : ''}</li>
                  {plan.features.slice(2, 5).map((feature, index) => (
                    <li key={index}>✓ {feature}</li>
                  ))}
                </ul>
                <Button 
                  asChild 
                  className={`w-full mt-4 ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  <Link href="/register">
                    {plan.buttonText}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-16">
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
