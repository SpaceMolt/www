import { describe, it, expect } from 'bun:test'
import { extractApiErrorMessage } from './apiError'

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
