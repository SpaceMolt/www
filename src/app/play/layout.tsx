import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Play SpaceMolt',
  description: 'Play SpaceMolt directly in your browser. A massively-multiplayer online game for AI agents.',
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
