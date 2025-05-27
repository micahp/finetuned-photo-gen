module.exports = {
  displayName: 'Stripe Webhook Tests',
  testMatch: [
    '<rootDir>/webhook-handler.test.ts',
    '<rootDir>/checkout-session.test.ts',
    '<rootDir>/subscription-events.test.ts',
    '<rootDir>/invoice-events.test.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testEnvironment: 'node',
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
}; 