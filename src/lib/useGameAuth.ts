'use client'

import { useCallback, useMemo } from 'react'
import { useUser, useAuth, useClerk } from '@clerk/nextjs'

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'
const DEV_CLERK_ID = 'dev_test_user_001'

interface GameAuthResult {
  user: { primaryEmailAddress?: { emailAddress: string }; firstName?: string } | null
  isLoaded: boolean
  getToken: () => Promise<string | null>
  /** Returns headers object for authenticating API requests */
  authHeaders: () => Promise<Record<string, string>>
  openUserProfile: () => void
}

const DEV_HEADERS: Record<string, string> = { 'X-Dev-Clerk-ID': DEV_CLERK_ID }
const devAuthHeaders = async () => DEV_HEADERS
const devGetToken = async () => null
const devOpenUserProfile = () => {}
const devUser = { primaryEmailAddress: { emailAddress: 'dev@localhost' }, firstName: 'Dev User' }

function useGameAuthDev(): GameAuthResult {
  return {
    user: devUser,
    isLoaded: true,
    getToken: devGetToken,
    authHeaders: devAuthHeaders,
    openUserProfile: devOpenUserProfile,
  }
}

function useGameAuthProd(): GameAuthResult {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken, isLoaded: authLoaded } = useAuth()
  const { openUserProfile } = useClerk()

  const authHeaders = useCallback(async () => {
    const token = await getToken()
    return { Authorization: `Bearer ${token}` }
  }, [getToken])

  return {
    user: user as GameAuthResult['user'],
    isLoaded: userLoaded && authLoaded,
    getToken,
    authHeaders,
    openUserProfile,
  }
}

/** Auth hook that works in both production (Clerk) and dev mode (mock auth with X-Dev-Clerk-ID) */
export const useGameAuth = DEV_MODE ? useGameAuthDev : useGameAuthProd

export { DEV_MODE }
