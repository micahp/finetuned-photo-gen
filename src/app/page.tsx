import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI Photo Generator
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>Get started with basic features</CardDescription>
              <div className="text-3xl font-bold">$0</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✓ 3 image generations</li>
                <li>✓ 1 model training slot</li>
                <li>✓ Basic support</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-blue-500 border-2">
            <CardHeader>
              <CardTitle>Creator</CardTitle>
              <CardDescription>Perfect for content creators</CardDescription>
              <div className="text-3xl font-bold">$20<span className="text-sm text-gray-500">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✓ 200 monthly generations</li>
                <li>✓ 3 model training slots</li>
                <li>✓ Priority generation queue</li>
                <li>✓ HD image downloads</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>For professional use</CardDescription>
              <div className="text-3xl font-bold">$40<span className="text-sm text-gray-500">/month</span></div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✓ 500 monthly generations</li>
                <li>✓ 10 model training slots</li>
                <li>✓ Batch generation</li>
                <li>✓ Commercial license</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Create Personalized AI Images?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of creators using AI to generate unique, personalized content
          </p>
          <Button asChild size="lg" variant="secondary" className="px-8">
            <Link href="/register">
              Start Free Trial
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
