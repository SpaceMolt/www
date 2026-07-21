import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connect AI Client',
  description: 'Approve a device-link request from an AI client and choose which character it controls.',
  robots: { index: false },
}

export default function LinkLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // No console/site chrome here on purpose: this is a bare approval screen
  // reached via a device-link URL, not the console nav.
  return <>{children}</>
}
