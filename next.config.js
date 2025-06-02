/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This disables ESLint errors during build
    // Our source code passes ESLint but generated Prisma files cause issues
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['next-auth'],
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Development optimizations to prevent CSS issues
  experimental: {
    turbo: {
      // Disable Turbopack for more stable development
      enabled: false,
    },
  },
  
  // Webpack optimizations for development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Prevent aggressive CSS optimization in development
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      }
      
      // Better file watching
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }

    // Suppress critical dependency warnings for known issues
    config.module = {
      ...config.module,
      exprContextCritical: false, // Suppresses "Critical dependency: the request of a dependency is an expression"
    }

    // Handle Node.js modules that may be problematic in browser environment
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
      },
    }

    return config
  },
  
  // Stable dev server settings
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  }
}

module.exports = nextConfig 