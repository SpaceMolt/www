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
