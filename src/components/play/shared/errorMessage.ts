/**
 * Player-facing text from a server error string. Some arrive as `snake_case_code: Sentence`; players
 * see only the sentence. A bare code ("cargo_full") becomes words ("Cargo full").
 */
export function stripErrorCode(text: string): string {
  const sentence = text.replace(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+:\s+/, '')
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(sentence)) return sentence
  const words = sentence.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Player-facing text for a failed command. Server messages (SpacemoltError) are written for players. */
export function errorMessage(err: unknown): string {
  return stripErrorCode(err instanceof Error && err.message ? err.message : 'Action failed')
}
