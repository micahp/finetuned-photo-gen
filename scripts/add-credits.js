#!/usr/bin/env node

const { PrismaClient } = require('../src/generated/prisma')

async function addCredits() {
  const prisma = new PrismaClient()
  
  try {
    const email = process.argv[2]
    const credits = parseInt(process.argv[3])
    
    if (!email || !credits) {
      console.error('Usage: node add-credits.js <email> <credits>')
      process.exit(1)
    }
    
    console.log(`Adding ${credits} credits to ${email}...`)
    
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { credits: credits },
      select: { 
        id: true,
        email: true, 
        name: true,
        credits: true 
      }
    })
    
    console.log('✅ Credits updated successfully:')
    console.log(`User: ${user.name} (${user.email})`)
    console.log(`Credits: ${user.credits}`)
    
  } catch (error) {
    if (error.code === 'P2025') {
      console.error('❌ User not found with email:', process.argv[2])
    } else {
      console.error('❌ Error updating credits:', error.message)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addCredits() 