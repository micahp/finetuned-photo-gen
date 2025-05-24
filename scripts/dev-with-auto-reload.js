const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

let devProcess
let isRestarting = false

function clearBuildCache() {
  console.log('🧹 Clearing build cache...')
  
  // Clear .next directory
  const nextDir = path.join(process.cwd(), '.next')
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true })
    console.log('✅ Cleared .next directory')
  }
  
  // Clear node_modules cache
  const cacheDir = path.join(process.cwd(), 'node_modules/.cache')
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true })
    console.log('✅ Cleared node_modules cache')
  }
}

function startDevServer() {
  if (isRestarting) return
  
  console.log('🚀 Starting Next.js development server...')
  
  devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    shell: true,
    cwd: process.cwd()
  })

  devProcess.stdout.on('data', (data) => {
    const output = data.toString()
    process.stdout.write(output)
    
    // Check for webpack chunk errors
    if ((output.includes('Cannot find module') && output.includes('.js')) ||
        output.includes('ChunkLoadError') ||
        output.includes('Loading chunk') ||
        (output.includes('webpack') && output.includes('error'))) {
      
      console.log('\n🔄 Webpack chunk error detected, restarting server...')
      restartServer()
    }
    
    // Check for build errors that might cause chunk issues
    if (output.includes('Error: Module not found') ||
        output.includes('ModuleNotFoundError')) {
      
      console.log('\n🔄 Module resolution error detected, restarting server...')
      restartServer()
    }
  })

  devProcess.stderr.on('data', (data) => {
    const error = data.toString()
    process.stderr.write(error)
    
    // Check for critical errors that require restart
    if (error.includes('Cannot find module') ||
        error.includes('ENOENT') ||
        error.includes('webpack')) {
      
      console.log('\n🔄 Critical error detected, restarting server...')
      restartServer()
    }
  })

  devProcess.on('close', (code) => {
    if (!isRestarting && code !== 0) {
      console.log(`\n💥 Dev server exited with code ${code}, restarting...`)
      setTimeout(() => restartServer(), 1000)
    }
  })

  devProcess.on('error', (error) => {
    console.error('❌ Failed to start dev server:', error)
    setTimeout(() => restartServer(), 2000)
  })
}

function restartServer() {
  if (isRestarting) return
  
  isRestarting = true
  console.log('\n🛑 Stopping development server...')
  
  if (devProcess) {
    devProcess.kill('SIGTERM')
    
    // Force kill if it doesn't stop gracefully
    setTimeout(() => {
      if (devProcess) {
        devProcess.kill('SIGKILL')
      }
    }, 5000)
  }
  
  // Clear cache and restart after a delay
  setTimeout(() => {
    clearBuildCache()
    isRestarting = false
    startDevServer()
  }, 2000)
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...')
  if (devProcess) {
    devProcess.kill()
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...')
  if (devProcess) {
    devProcess.kill()
  }
  process.exit(0)
})

// Initial cache clear and start
console.log('🔧 Auto-reloading development server starting...')
clearBuildCache()
startDevServer() 