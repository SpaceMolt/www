import { ConsoleShell } from '@/components/console/ConsoleShell'
import { ConsoleSearch } from '@/components/search/ConsoleSearch'

// All content routes render inside the ops-console chrome: topbar telemetry,
// left navigation rail, and the live pane. Pages stay server components —
// they pass through ConsoleShell as children.
//
// ConsoleSearch is mounted once, above the page: it owns the single Cmd-K
// dialog (available on every console page) and renders the visible search field
// on /docs, which triggers that same dialog.
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConsoleShell>
      <ConsoleSearch />
      {children}
    </ConsoleShell>
  )
}
