import { CommunityFooter } from '@/components/CommunityFooter'

// Every page under /docs (reference, guides, getting-started, clients) closes
// with the same community rail.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommunityFooter />
    </>
  )
}
