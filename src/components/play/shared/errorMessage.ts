/** Player-facing text for a failed command. Server messages (SpacemoltError) are already written for players. */
export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Action failed'
}
