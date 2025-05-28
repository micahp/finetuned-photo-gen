// Mock for next-auth main module
const NextAuth = jest.fn(() => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  },
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

module.exports = NextAuth
module.exports.default = NextAuth 