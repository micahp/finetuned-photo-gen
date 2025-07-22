#!/usr/bin/env node

// Usage: node create-test-user-zero-credits.js [email]
// Creates (or resets) a user with the given email to 0 credits and free plan.
// Defaults email to zero-credits@example.com

const { PrismaClient } = require('../src/generated/prisma')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()

  const email = (process.argv[2] || 'zero-credits@example.com').toLowerCase()
  const passwordPlain = 'password123'
  const hashedPassword = await bcrypt.hash(passwordPlain, 10)

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        credits: 0,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
      },
      create: {
        email,
        name: 'Zero Credits User',
        password: hashedPassword,
        credits: 0,
        subscriptionStatus: 'free',
      },
      select: { id: true, email: true, credits: true }
    })

    console.log('✅ Test user ready:')
    console.log(`   Email: ${user.email}`)
    console.log('   Password: password123')
    console.log('   Credits:', user.credits)
  } catch (err) {
    console.error('❌ Failed to create/update test user:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main() 