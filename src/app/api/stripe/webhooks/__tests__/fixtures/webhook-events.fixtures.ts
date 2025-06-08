import Stripe from 'stripe';

export const TEST_IDS = {
  userId: 'user_test_123',
  stripeCustomerId: 'cus_test_456',
  sessionId: 'cs_test_789',
  subscriptionId: 'sub_test_id_for_simple_case',
  productId: 'prod_basic',
  priceId: 'price_basic',
  paymentIntentId: 'pi_test_123',
  invoiceId: 'in_test_123',
} as const;

export const TEST_PLANS = {
  basic: {
    id: 'prod_basic',
    name: 'Basic Plan',
    credits: 10,
  },
  standard: {
    id: 'prod_standard',
    name: 'Standard Plan',
    credits: 75,
  },
  premium: {
    id: 'prod_premium',
    name: 'Premium Plan',
    credits: 200,
  },
} as const;

export const createCheckoutSessionEvent = (
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Event => ({
  id: 'evt_test_checkout',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: TEST_IDS.sessionId,
      mode: 'subscription' as Stripe.Checkout.Session.Mode,
      customer: TEST_IDS.stripeCustomerId,
      subscription: TEST_IDS.subscriptionId,
      metadata: { userId: TEST_IDS.userId },
      ...overrides,
    } as Stripe.Checkout.Session,
  },
  // Add other required Stripe.Event fields
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
} as Stripe.Event);

export const createSubscriptionEvent = (
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted',
  overrides: Partial<Stripe.Subscription> = {}
): Stripe.Event => ({
  id: `evt_test_${type.replace('.', '_')}`,
  type,
  data: {
    object: {
      id: TEST_IDS.subscriptionId,
      customer: TEST_IDS.stripeCustomerId,
      status: 'active',
      items: {
        data: [{
          price: {
            product: TEST_IDS.productId,
            id: TEST_IDS.priceId,
          },
        }],
      },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      metadata: { userId: TEST_IDS.userId },
      ...overrides,
    } as Stripe.Subscription,
  },
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
} as Stripe.Event);

export const createInvoiceEvent = (
  overrides: Partial<Stripe.Invoice> = {}
): Stripe.Event => ({
  id: 'evt_test_invoice_payment_succeeded',
  type: 'invoice.payment_succeeded',
  data: {
    object: {
      id: TEST_IDS.invoiceId,
      customer: TEST_IDS.stripeCustomerId,
      subscription: TEST_IDS.subscriptionId,
      paid: true,
      status: 'paid',
      billing_reason: 'subscription_cycle',
      amount_paid: 2900,
      lines: {
        data: [{
          price: {
            product: TEST_IDS.productId,
            id: TEST_IDS.priceId,
            type: 'recurring',
          },
          quantity: 1,
          period: {
            start: Math.floor(Date.now() / 1000),
            end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          },
        }],
      },
      ...overrides,
    } as Stripe.Invoice,
  },
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
} as Stripe.Event);

export const createMockUser = (overrides = {}) => ({
  id: TEST_IDS.userId,
  stripeCustomerId: TEST_IDS.stripeCustomerId,
  credits: 0,
  email: 'user@example.com',
  subscriptions: [],
  ...overrides,
});

export const createMockProduct = (plan: keyof typeof TEST_PLANS = 'basic') => ({
  id: TEST_PLANS[plan].id,
  name: TEST_PLANS[plan].name,
  metadata: { credits: String(TEST_PLANS[plan].credits) },
});

export const createMockSubscription = (overrides = {}) => ({
  id: TEST_IDS.subscriptionId,
  status: 'active',
  items: {
    data: [{
      price: {
        product: createMockProduct(),
        id: TEST_IDS.priceId,
      },
    }],
  },
  customer: TEST_IDS.stripeCustomerId,
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
  metadata: { userId: TEST_IDS.userId },
  ...overrides,
}); 