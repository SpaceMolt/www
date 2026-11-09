/**
 * Player-facing text for a failed command. Server messages (SpacemoltError) are written for players,
 * but some arrive as `snake_case_code: Sentence`; players see only the sentence.
 */
export function errorMessage(err: unknown): string {
  const message = err instanceof Error && err.message ? err.message : 'Action failed'
  return message.replace(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+:\s+/, '')
}
