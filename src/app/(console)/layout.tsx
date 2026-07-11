import { ConsoleShell } from '@/components/console/ConsoleShell'

// All content routes render inside the ops-console chrome: topbar telemetry,
// left navigation rail, and the live pane. Pages stay server components —
// they pass through ConsoleShell as children.
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ConsoleShell>{children}</ConsoleShell>
}
