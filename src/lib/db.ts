// Import server-only marker to ensure this module is not bundled for the client
import './server-only';
import { PrismaClient } from '@/generated/prisma'

// This prevents PrismaClient from being instantiated in browser contexts
// https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

declare global {
  var prisma: PrismaClient | undefined;
}

// Always check we're on the server
if (typeof window !== 'undefined') {
  throw new Error(
    'PrismaClient cannot be used on the client side. Please use server components or API routes.'
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Helper function to get the Prisma client safely
export function getPrismaClient() {
  if (typeof window === 'undefined') {
    return prisma
  }
  
  throw new Error(
    'PrismaClient cannot be used on the client side. Please use server components or API routes.'
  )
} 