// Mock for next-auth/react module
const useSession = jest.fn(() => ({
  data: null,
  status: 'loading',
  update: jest.fn(),
}))

const signIn = jest.fn()
const signOut = jest.fn()
const getSession = jest.fn()
const getCsrfToken = jest.fn()
const getProviders = jest.fn()
const SessionProvider = ({ children }) => children

module.exports = {
  useSession,
  signIn,
  signOut,
  getSession,
  getCsrfToken,
  getProviders,
  SessionProvider,
} 