import { create } from 'zustand'
import { Session } from 'next-auth'

interface AuthState {
  user: Session['user'] | null
  isLoading: boolean
  setUser: (user: Session['user'] | null) => void
  setLoading: (loading: boolean) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  clearUser: () => set({ user: null }),
})) 