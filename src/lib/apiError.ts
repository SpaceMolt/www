/**
 * Extracts a human-readable message from a gameserver API error response body.
 *
 * The gameserver returns errors shaped like:
 *   { "error": { "code": "...", "message": "..." } }
 *
 * Older callers did `new Error(body.error)`, which stringified the nested object
 * to the literal "[object Object]" in the UI (dc#143010). This helper safely
 * pulls out the message string regardless of whether `error` is an object or a
 * plain string, and falls back to a status-based message.
 */
export function extractApiErrorMessage(
  body: unknown,
  status: number,
  fallbackPrefix = 'Registration failed'
): string {
  const fallback = `${fallbackPrefix} (${status})`
  if (!body || typeof body !== 'object') return fallback

  const b = body as Record<string, unknown>

  // { error: "string" }
  if (typeof b.error === 'string' && b.error.trim()) return b.error

  // { error: { message: "string" } }
  if (b.error && typeof b.error === 'object') {
    const msg = (b.error as Record<string, unknown>).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }

  // { message: "string" }
  if (typeof b.message === 'string' && b.message.trim()) return b.message

  return fallback
}

/**
 * Detects whether a gameserver API error is an authentication / session-expiry
 * failure the user can recover from by signing in again.
 *
 * Used by the /play human-signup flow (gh#1367): when a Clerk session expires
 * mid-signup the register call fails with "Session not found or expired" (401),
 * and the form previously left the user stuck with no way to re-authenticate.
 * A true result surfaces a Login button so the user can recover.
 */
export function isSessionAuthError(status: number, message: string): boolean {
  if (status === 401 || status === 403) return true
  const m = (message || '').toLowerCase()
  return (
    m.includes('session not found') ||
    m.includes('session expired') ||
    m.includes('session is required') ||
    m.includes('not found or expired') ||
    m.includes('unauthorized') ||
    m.includes('unauthenticated')
  )
}
