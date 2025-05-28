// Global test setup for webhook tests
beforeAll(() => {
  // Suppress console output during tests unless explicitly testing console methods
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
}); 