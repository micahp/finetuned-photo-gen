// Mock for next-auth/providers/credentials
const CredentialsProvider = jest.fn(() => ({
  id: 'credentials',
  name: 'credentials',
  type: 'credentials',
  credentials: {},
  authorize: jest.fn(),
}))

module.exports = CredentialsProvider
module.exports.default = CredentialsProvider 