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

// Global mock for Prisma Client
const createPrismaMock = () => ({
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    // Add other user model methods if needed
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    // Add other creditTransaction model methods if needed
  },
  generatedImage: {
    create: jest.fn(),
    count: jest.fn(),
    // Add other generatedImage model methods if needed
  },
  userModel: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    // Add other userModel methods if needed
  },
  jobQueue: { // Added based on usage in training/jobs/route.ts
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  // Add other Prisma models as needed by the application
  // e.g. Session: { ... }, Account: { ... }, etc.
});

// Assign to globalThis for better type safety with TypeScript if you have global type augmentations
// For JavaScript or basic TypeScript, global.prismaMock is also common.
globalThis.prismaMock = createPrismaMock();

// Global mock for Prisma $transaction method (already existed, ensure it uses the new prismaMock if appropriate)
// The previous global.mockPrismaTransaction might be redundant if prismaMock.$transaction is used directly.
// For now, keep both but prefer using prismaMock.$transaction in tests for consistency.
global.mockPrismaTransaction = globalThis.prismaMock.$transaction; // Alias to the one in prismaMock

// Global mock for CreditService
global.mockCreditServiceSpendCredits = jest.fn()
global.mockCreditServiceAddCredits = jest.fn()
global.mockCreditServiceRecordTransaction = jest.fn()
global.mockCreditServiceGetUsageAnalytics = jest.fn()
global.mockCreditServiceCheckUsageLimits = jest.fn()
global.mockCreditServiceCanAfford = jest.fn()
global.mockCreditServiceGetLowCreditNotification = jest.fn()

beforeEach(() => {
  // Reset all mocks before each test
  
  // Reset prismaMock methods
  const pm = globalThis.prismaMock;
  pm.$transaction.mockReset();
  pm.$queryRaw.mockReset();
  pm.$executeRaw.mockReset();
  pm.$queryRawUnsafe.mockReset();
  pm.$executeRawUnsafe.mockReset();
  // Reset other $ methods if added

  Object.values(pm.user).forEach(mockFn => mockFn.mockReset());
  Object.values(pm.creditTransaction).forEach(mockFn => mockFn.mockReset());
  Object.values(pm.generatedImage).forEach(mockFn => mockFn.mockReset());
  Object.values(pm.userModel).forEach(mockFn => mockFn.mockReset());
  Object.values(pm.jobQueue).forEach(mockFn => mockFn.mockReset());
  // Reset other models if added

  // Default implementation for $transaction, if needed globally
  pm.$transaction.mockImplementation(async (callback) => {
    // This default mockTx should use the global prismaMock's methods
    // so that individual test mocks on e.g. prismaMock.user.update are reflected within transactions.
    return callback(globalThis.prismaMock); 
  });

  // Reset all credit service mocks before each test
  if (global.mockCreditServiceSpendCredits) {
    global.mockCreditServiceSpendCredits.mockResolvedValue({
      success: true,
      newBalance: 9,
    })
  }
  
  if (global.mockCreditServiceAddCredits) {
    global.mockCreditServiceAddCredits.mockResolvedValue({
      success: true,
      newBalance: 11,
    })
  }
  
  if (global.mockCreditServiceRecordTransaction) {
    global.mockCreditServiceRecordTransaction.mockResolvedValue(undefined)
  }
})

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