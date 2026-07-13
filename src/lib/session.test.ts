import { describe, it, expect } from 'bun:test'
import { parseSessionId } from './session'

describe('parseSessionId', () => {
  it('extracts the id from the gameserver { session: { id } } shape', () => {
    const body = {
      result: { message: 'Session created' },
      session: {
        id: 'sess_abc123',
        created_at: '2026-07-13T00:00:00Z',
        expires_at: '2026-07-13T01:00:00Z',
      },
    }
    expect(parseSessionId(body)).toBe('sess_abc123')
  })

  it('throws instead of returning undefined for the old top-level session_id shape', () => {
    // Regression for the /play signup bug: the code read body.session_id, which
    // never existed, so the register call sent "X-Session-ID: undefined" and
    // every inline player creation failed with "Session not found or expired".
    const body = { session_id: 'sess_abc123' }
    expect(() => parseSessionId(body)).toThrow(/missing session\.id/)
  })

  it('throws on an empty session object', () => {
    expect(() => parseSessionId({ session: {} })).toThrow(/missing session\.id/)
  })

  it('throws on an empty-string id', () => {
    expect(() => parseSessionId({ session: { id: '' } })).toThrow(/missing session\.id/)
  })

  it('throws on a non-string id', () => {
    expect(() => parseSessionId({ session: { id: 42 } })).toThrow(/missing session\.id/)
  })

  it('throws on null / undefined bodies', () => {
    expect(() => parseSessionId(null)).toThrow(/missing session\.id/)
    expect(() => parseSessionId(undefined)).toThrow(/missing session\.id/)
  })
})
