/**
 * Character search for the /play selector, the recon roster and the
 * `/play?player=` link: a name substring, or the full player ID (operators'
 * scripts and databases key characters by ID).
 */
export function matchesPlayer(query: string, { id, username }: { id: string; username: string }): boolean {
  const q = query.trim().toLowerCase()
  return username.toLowerCase().includes(q) || id.toLowerCase() === q
}

/** The character a `/play?player=` link names, by ID or exact name (any case). */
export function findPlayer<T extends { id: string; username: string }>(players: T[], query: string): T | undefined {
  const q = query.trim().toLowerCase()
  return players.find((p) => p.id.toLowerCase() === q) ?? players.find((p) => p.username.toLowerCase() === q)
}
