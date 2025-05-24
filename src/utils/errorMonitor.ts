'use client'

let monitoringSetup = false

export function setupErrorMonitoring() {
  // Prevent multiple setups
  if (monitoringSetup || typeof window === 'undefined') return
  
  console.log('🔍 Setting up error monitoring...')
  monitoringSetup = true

  // Monitor fetch requests for 500 errors
  const originalFetch = window.fetch
  
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const response = await originalFetch(...args)
      const url = args[0]?.toString() || ''
      
      // Check for auth session failures or webpack chunk errors
      if (url.includes('/api/auth/session') && response.status === 500) {
        console.log('🔄 Auth session error detected, reloading page in 1 second...')
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
      
      // Check for 404s on webpack chunks
      if (response.status === 404 && (url.includes('/_next/') || url.includes('.js'))) {
        console.log('🔄 Missing asset detected, reloading page...')
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
      
      return response
    } catch (error: any) {
      console.error('Fetch error:', error)
      
      // Check for chunk loading errors
      if (error.message?.includes('Loading chunk') || 
          error.message?.includes('Cannot find module')) {
        console.log('🔄 Chunk loading error detected, reloading page...')
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
      
      throw error
    }
  }

  // Monitor for unhandled promise rejections (often webpack chunk errors)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason
    
    if (error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Cannot find module') ||
        error?.name === 'ChunkLoadError') {
      
      console.log('🔄 Unhandled chunk error detected, reloading page...')
      event.preventDefault() // Prevent the error from being logged
      
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  })

  // Monitor for global errors
  window.addEventListener('error', (event) => {
    const error = event.error
    
    if (error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Cannot find module') ||
        error?.name === 'ChunkLoadError') {
      
      console.log('🔄 Global chunk error detected, reloading page...')
      
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  })

  console.log('✅ Error monitoring active')
}

// Auto-setup if in browser environment
if (typeof window !== 'undefined') {
  // Setup after a short delay to ensure everything is loaded
  setTimeout(setupErrorMonitoring, 100)
} 