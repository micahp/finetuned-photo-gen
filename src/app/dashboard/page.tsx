import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome to your AI Photo Generation dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Credits Remaining</CardTitle>
              <CardDescription>Available for image generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">3</div>
              <p className="text-sm text-gray-500 mt-1">Free tier limit</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Models Trained</CardTitle>
              <CardDescription>Your custom AI models</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">0</div>
              <p className="text-sm text-gray-500 mt-1">Ready to create your first model</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images Generated</CardTitle>
              <CardDescription>Total AI-generated images</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">0</div>
              <p className="text-sm text-gray-500 mt-1">Start generating today</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Your First Model</CardTitle>
                <CardDescription>
                  Upload 10-20 photos of yourself to train a personalized AI model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/dashboard/models/new">
                    Create Model
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Images</CardTitle>
                <CardDescription>
                  Use AI to create personalized images with custom prompts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full" disabled>
                  <Link href="/dashboard/generate">
                    Generate Images
                  </Link>
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Create a model first to enable image generation
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500">
                <p>No recent activity yet</p>
                <p className="text-sm mt-1">
                  Create your first model to see activity here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 