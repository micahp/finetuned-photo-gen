import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'

// Add polyfills for Web APIs not available in Jest environment
global.TransformStream = class TransformStream {
  constructor() {
    this.readable = new ReadableStream()
    this.writable = new WritableStream()
  }
}

global.ReadableStream = class ReadableStream {
  constructor() {}
}

global.WritableStream = class WritableStream {
  constructor() {}
}

// Add Request and Response polyfills for Next.js API testing
if (!global.Request) {
  global.Request = class Request {
    constructor(input, init = {}) {
      Object.defineProperty(this, 'url', {
        value: input,
        writable: false,
        enumerable: true,
        configurable: true
      })
      this.method = init.method || 'GET'
      this.headers = new Map(Object.entries(init.headers || {}))
      this.body = init.body
      this._bodyText = init.body
    }

    async json() {
      return JSON.parse(this._bodyText)
    }

    async text() {
      return this._bodyText
    }
  }
}

if (!global.Response) {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body
      this.status = init.status || 200
      this.statusText = init.statusText || 'OK'
      this.headers = new Map(Object.entries(init.headers || {}))
    }

    async json() {
      return JSON.parse(this.body)
    }

    async text() {
      return this.body
    }

    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      })
    }
  }
}

// Add NextResponse polyfill
if (!global.NextResponse) {
  global.NextResponse = {
    json: (data, init = {}) => {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      })
    }
  }
}

// Mock fetch for tests with comprehensive response methods
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    blob: () => Promise.resolve(new Blob()),
    headers: new Map(),
  })
)

/*
// Mock console methods to prevent test output noise --- Temporarily Commented Out for Debugging
const originalConsole = global.console
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}
*/ 