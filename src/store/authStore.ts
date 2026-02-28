import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'manager' | 'pharmacist' | 'dataentry'
}

interface AuthState {
  currentUser: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

const AUTH_STORAGE_KEY = 'skbz-cmh-rawalakot-pharmacy-auth'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,

      login: (user: User) =>
        set({ currentUser: user, isAuthenticated: true }),

      logout: () =>
        set({ currentUser: null, isAuthenticated: false })
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
