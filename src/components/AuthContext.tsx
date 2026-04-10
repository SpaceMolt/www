'use client'

import { createContext, useContext } from 'react'

/**
 * Tells client components whether ClerkProvider is available.
 * Set by AuthProvider in layout.tsx.
 */
const AuthAvailableContext = createContext(false)

export function AuthAvailableProvider({ available, children }: { available: boolean; children: React.ReactNode }) {
  return <AuthAvailableContext.Provider value={available}>{children}</AuthAvailableContext.Provider>
}

export function useAuthAvailable() {
  return useContext(AuthAvailableContext)
}
