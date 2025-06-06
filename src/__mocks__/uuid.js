// Mock for UUID module
module.exports = {
  v4: jest.fn(() => 'mock-uuid-v4'),
  v1: jest.fn(() => 'mock-uuid-v1'),
  v3: jest.fn(() => 'mock-uuid-v3'),
  v5: jest.fn(() => 'mock-uuid-v5'),
  __esModule: true,
  default: {
    v4: jest.fn(() => 'mock-uuid-v4'),
  },
} 