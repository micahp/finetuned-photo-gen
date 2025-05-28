import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function makeUserAdmin(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { isAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
      }
    })

    console.log('✅ User updated successfully:')
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)
    console.log(`   Admin: ${user.isAdmin}`)
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      console.error('❌ User not found with email:', email)
    } else {
      console.error('❌ Error updating user:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.error('❌ Please provide an email address')
  console.log('Usage: npx tsx scripts/make-admin.ts user@example.com')
  process.exit(1)
}

makeUserAdmin(email) 