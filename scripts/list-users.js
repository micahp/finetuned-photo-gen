// scripts/list-users.js
const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        stripeCustomerId: true,
        credits: true,
        createdAt: true
      }
    });

    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log('--------------------');
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Name: ${user.name || 'N/A'}`);
      console.log(`Subscription Status: ${user.subscriptionStatus || 'N/A'}`);
      console.log(`Subscription Plan: ${user.subscriptionPlan || 'free'}`);
      console.log(`Credits: ${user.credits || 0}`);
      console.log(`Created: ${user.createdAt}`);
    });

  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers()
  .catch(e => {
    console.error(e);
    process.exit(1);
  }); 