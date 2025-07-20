#!/usr/bin/env node

const { PrismaClient } = require('../src/generated/prisma')

async function setCreatorCredits() {
  const prisma = new PrismaClient()
  const TARGET_PLAN = 'creator'
  const NEW_CREDITS = 500

  try {
    console.log(`🔄 Setting credits to ${NEW_CREDITS} for all users on the '${TARGET_PLAN}' plan...`)

    const { count } = await prisma.user.updateMany({
      where: { subscriptionPlan: TARGET_PLAN },
      data: { credits: NEW_CREDITS }
    })

    console.log(`✅ Updated ${count} user${count === 1 ? '' : 's'} successfully.`)
  } catch (error) {
    console.error('❌ Error updating credits:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setCreatorCredits() 