import { describe, it, expect } from 'bun:test'
import { extractApiErrorMessage, isSessionAuthError } from './apiError'

describe('extractApiErrorMessage', () => {
  it('extracts the message from the gameserver { error: { code, message } } shape', () => {
    // Regression for dc#143010: registration showed "[object Object]" because the
    // gameserver returns its error nested under error.message, and the old code
    // threw new Error(body.error) — stringifying the object to "[object Object]".
    const body = {
      error: {
        code: 'session_required',
        message: 'A session is required. Create one first.',
      },
    }
    expect(extractApiErrorMessage(body, 401)).toBe(
      'A session is required. Create one first.'
    )
  })

  it('never returns "[object Object]" when error is an object', () => {
    const body = { error: { code: 'x', message: 'real message' } }
    expect(extractApiErrorMessage(body, 422)).not.toBe('[object Object]')
  })

  it('handles a string error field', () => {
    const body = { error: 'plain string error' }
    expect(extractApiErrorMessage(body, 400)).toBe('plain string error')
  })

  it('falls back to a status message when body is null', () => {
    expect(extractApiErrorMessage(null, 401)).toBe('Registration failed (401)')
  })

  it('falls back to a status message when error has no message', () => {
    const body = { error: { code: 'weird' } }
    expect(extractApiErrorMessage(body, 500)).toBe('Registration failed (500)')
  })

  it('uses a top-level message field if present', () => {
    expect(extractApiErrorMessage({ message: 'top level' }, 400)).toBe('top level')
  })
})

describe('isSessionAuthError', () => {
  it('treats the reporter "Session not found or expired" message as recoverable (gh#1367)', () => {
    // rsned hit this during human signup; the form must offer a Login path.
    expect(isSessionAuthError(401, 'Session not found or expired')).toBe(true)
  })

  it('treats 401/403 statuses as auth errors regardless of message', () => {
    expect(isSessionAuthError(401, '')).toBe(true)
    expect(isSessionAuthError(403, 'forbidden')).toBe(true)
  })

  it('matches session-required and unauthorized messages', () => {
    expect(isSessionAuthError(400, 'A session is required. Create one first.')).toBe(true)
    expect(isSessionAuthError(400, 'Unauthorized')).toBe(true)
    expect(isSessionAuthError(400, 'unauthenticated request')).toBe(true)
  })

  it('does not flag ordinary validation errors as auth errors', () => {
    expect(isSessionAuthError(422, 'Username already taken')).toBe(false)
    expect(isSessionAuthError(400, 'Username must be 3-24 characters')).toBe(false)
    expect(isSessionAuthError(500, 'Internal server error')).toBe(false)
  })
})
