import { GET, POST } from '@/lib/next-auth'

// Force this route to use Node.js runtime instead of Edge Runtime
// This is needed because we use bcryptjs which requires Node.js APIs
export const runtime = 'nodejs'

export { GET, POST } 