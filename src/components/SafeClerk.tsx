'use client'

import React from 'react'
import { useAuthAvailable } from '@/components/AuthContext'

/**
 * Safe wrappers for Clerk auth components.
 * Uses AuthAvailableContext to know if ClerkProvider is present.
 * When absent (local dev without CLERK_SECRET_KEY), renders graceful fallbacks
 * without ever importing Clerk — zero console errors.
 */

export function SafeSignedOut({ children }: { children: React.ReactNode }) {
  const hasAuth = useAuthAvailable()
  if (!hasAuth) return <>{children}</>
  const { SignedOut } = require('@clerk/nextjs')
  return <SignedOut>{children}</SignedOut>
}

export function SafeSignedIn({ children }: { children: React.ReactNode }) {
  const hasAuth = useAuthAvailable()
  if (!hasAuth) return null
  const { SignedIn } = require('@clerk/nextjs')
  return <SignedIn>{children}</SignedIn>
}

export function SafeSignUpButton({ children, mode }: { children: React.ReactNode; mode?: string }) {
  const hasAuth = useAuthAvailable()
  if (!hasAuth) return <>{children}</>
  const { SignUpButton } = require('@clerk/nextjs')
  return <SignUpButton mode={mode}>{children}</SignUpButton>
}
