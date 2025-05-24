'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  isReloading: boolean
}

class AutoReloadErrorBoundary extends Component<Props, State> {
  private reloadTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isReloading: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, isReloading: false }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Check if it's a webpack/module loading error
    const isWebpackError = 
      error.message.includes('Cannot find module') || 
      error.message.includes('MODULE_NOT_FOUND') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('webpack') ||
      error.name === 'ChunkLoadError'

    if (isWebpackError) {
      console.log('🔄 Webpack chunk error detected, reloading in 2 seconds...')
      this.setState({ isReloading: true })
      
      this.reloadTimeout = setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }

  componentWillUnmount() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {this.state.isReloading ? 'Reloading Application...' : 'Something went wrong'}
            </h2>
            <p className="text-gray-600 mb-4">
              {this.state.isReloading 
                ? 'Detected a build error, automatically reloading...' 
                : 'The application encountered an error.'
              }
            </p>
            {!this.state.isReloading && (
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Reload Page
              </button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default AutoReloadErrorBoundary 