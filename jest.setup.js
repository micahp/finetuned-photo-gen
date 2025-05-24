import '@testing-library/jest-dom'

// Polyfill for Next.js API routes in tests
global.Request = global.Request || require('node-fetch').Request
global.Response = global.Response || require('node-fetch').Response
global.Headers = global.Headers || require('node-fetch').Headers

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db' 