'use client'

import { SignedIn, SignedOut, SignUpButton } from '@clerk/nextjs'
import Link from 'next/link'

export function GetStartedButton({ className }: { className?: string }) {
  return (
    <>
      <SignedOut>
        <SignUpButton mode="modal">
          <button className={className}>Get Started</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard" className={className}>Dashboard</Link>
      </SignedIn>
    </>
  )
}
