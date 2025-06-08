const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

/**
 * Reset a user's subscription to the free plan
 * This script is useful for testing the subscription flow after refunds
 */
async function resetUserSubscription(email) {
  try {
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscriptions: true }
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }

    console.log(`Found user: ${user.name || user.email}`);
    console.log(`Current subscription status: ${user.subscriptionStatus}`);
    console.log(`Current subscription plan: ${user.subscriptionPlan || 'free'}`);

    // Update the user record
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'inactive',
        subscriptionPlan: 'free',
        // Keep the stripeCustomerId in case they subscribe again
      },
    });

    // Update any active subscription records
    if (user.subscriptions?.length > 0) {
      for (const subscription of user.subscriptions) {
        if (subscription.status === 'active') {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'canceled' }
          });
          console.log(`Marked subscription ${subscription.stripeSubscriptionId} as canceled`);
        }
      }
    }

    console.log(`Successfully reset user to free plan:`);
    console.log(`New subscription status: ${updatedUser.subscriptionStatus}`);
    console.log(`New subscription plan: ${updatedUser.subscriptionPlan || 'free'}`);

  } catch (error) {
    console.error('Error resetting user subscription:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get the email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Please provide a user email address');
  console.error('Usage: node scripts/reset-user-subscription.js user@example.com');
  process.exit(1);
}

resetUserSubscription(email)
  .catch(e => {
    console.error(e);
    process.exit(1);
  }); 