import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { User } from '@/generated/prisma'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createUser(email: string, password: string, name?: string): Promise<Omit<User, 'password'>> {
  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase()
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })

  if (existingUser) {
    throw new Error('User with this email already exists')
  }

  // Hash password
  const hashedPassword = await hashPassword(password)

  // Create user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      name,
    },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      stripeCustomerId: true,
      credits: true,
      createdAt: true,
      updatedAt: true,
    }
  })

  return user
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  })
}

export async function validateCredentials(email: string, password: string): Promise<Omit<User, 'password'> | null> {
  try {
    const user = await findUserByEmail(email)
    
    if (!user || !user.password) {
      return null
    }

    const isValid = await verifyPassword(password, user.password)
    
    if (!isValid) {
      return null
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  } catch (error) {
    // Log error for debugging but don't expose details to client
    console.error('Error validating credentials:', error)
    return null
  }
} 