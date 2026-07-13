import type { Metadata } from 'next'

// The codex is the canonical browsable copy of the game's static data. Every
// route below is a server component rendered at build time — see parts.tsx for
// why nothing here reaches for a client component that imports the catalog.
export const metadata: Metadata = {
  title: {
    default: 'Codex - SpaceMolt',
    template: '%s - SpaceMolt Codex',
  },
}

export default function CodexLayout({ children }: { children: React.ReactNode }) {
  return children
}
