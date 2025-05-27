# Stripe Webhook Tests

This directory contains the refactored webhook tests, organized by event type for better maintainability.

## Structure

```
__tests__/
├── fixtures/
│   └── webhook-events.ts          # Test data and event factories
├── utils/
│   └── test-helpers.ts            # Shared test utilities and mocks
├── webhook-handler.test.ts        # Basic webhook handler functionality
├── checkout-session.test.ts       # checkout.session.completed events
├── subscription-events.test.ts    # customer.subscription.* events
├── invoice-events.test.ts         # invoice.payment_succeeded events
├── setup.ts                       # Jest setup configuration
├── jest.config.js                 # Jest configuration for webhook tests
└── README.md                      # This file
```

## Key Improvements

### 1. **Separation of Concerns**
- Each webhook event type has its own test file
- Shared utilities are extracted to reusable modules
- Test data is centralized in fixtures

### 2. **Reusable Test Utilities**
- `createMockServices()`: Creates all necessary mocks
- `setupMocks()`: Configures Jest mocks before each test
- `expectSuccessfulResponse()`: Common assertion helper
- `createMockRequest()`: HTTP request factory

### 3. **Consistent Test Data**
- `TEST_IDS`: Centralized test identifiers
- `TEST_PLANS`: Predefined subscription plans
- Event factories: `createCheckoutSessionEvent()`, `createSubscriptionEvent()`, etc.

### 4. **Better Organization**
- Tests are grouped by webhook event type
- Each test file focuses on a single responsibility
- Common setup/teardown logic is shared

## Running Tests

```bash
# Run all webhook tests
npm test src/app/api/stripe/webhooks/__tests__

# Run specific test file
npm test checkout-session.test.ts

# Run with coverage
npm test -- --coverage src/app/api/stripe/webhooks/__tests__
```

## Adding New Tests

1. **For new webhook events**: Create a new test file following the pattern
2. **For new test data**: Add to `fixtures/webhook-events.ts`
3. **For new utilities**: Add to `utils/test-helpers.ts`

## Migration from Original

The original 925-line `route.test.ts` has been split into:
- **webhook-handler.test.ts**: ~100 lines (basic functionality)
- **checkout-session.test.ts**: ~300 lines (checkout events)
- **subscription-events.test.ts**: ~250 lines (subscription events)
- **invoice-events.test.ts**: ~200 lines (invoice events)
- **fixtures + utils**: ~200 lines (shared code)

**Total**: ~1050 lines (but much more maintainable!)

## Benefits

1. **Easier to navigate**: Find tests by event type
2. **Faster debugging**: Smaller, focused test files
3. **Better reusability**: Shared utilities reduce duplication
4. **Clearer intent**: Each test file has a single purpose
5. **Easier maintenance**: Changes to one event type don't affect others 