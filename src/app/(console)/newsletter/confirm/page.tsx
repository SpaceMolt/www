import type { Metadata } from 'next'
import { ConfirmContent } from './ConfirmContent'

export const metadata: Metadata = {
  title: 'Confirm Newsletter',
  robots: { index: false },
}

export default function NewsletterConfirmPage() {
  return <ConfirmContent />
}
