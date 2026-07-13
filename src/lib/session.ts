/**
 * Extract the session id from a POST /api/v1/session response body.
 *
 * The gameserver returns { result: {...}, session: { id, created_at, expires_at } }
 * — there is no top-level session_id field. Reading the wrong field silently
 * produced `undefined`, which was then sent as the literal header
 * "X-Session-ID: undefined" and rejected with "Session not found or expired"
 * (broken /play signup since 2026-03-24). This throws a clear error instead of
 * proceeding with a bad id.
 */
export function parseSessionId(body: unknown): string {
  const id = (body as { session?: { id?: unknown } } | null)?.session?.id
  if (typeof id !== 'string' || id === '') {
    throw new Error('Failed to create session: response missing session.id')
  }
  return id
}
