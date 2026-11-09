import { describe, it, expect } from 'bun:test'
import { buildConversations, mergeChat, recentContacts } from './ChatPanel'
import type { ChatMessage } from '@/lib/spacemolt/uiStore'

const msg = (m: Partial<ChatMessage>): ChatMessage => ({ channel: 'private', content: 'hi', ...m }) as ChatMessage

describe('ChatPanel history merge', () => {
  it('merges history pages and live messages oldest-first without duplicates', () => {
    const a = msg({ id: '1', timestamp: '2026-11-08T10:00:00Z' })
    const b = msg({ id: '2', timestamp: '2026-11-08T10:01:00Z' })
    const c = msg({ id: '3', timestamp: '2026-11-08T10:02:00Z' })
    expect(mergeChat([c, b], [a, b]).map((m) => m.id)).toEqual(['1', '2', '3'])
  })
})

describe('ChatPanel DM inbox', () => {
  it('groups by partner, newest conversation first, keeping the incoming sender id', () => {
    const list = buildConversations([
      msg({ id: '1', sender: 'Ana', sender_id: 'p-ana', timestamp: '2026-11-08T10:00:00Z' }),
      msg({ id: '2', sender: 'Me', sender_id: 'me', target_name: 'Bo', timestamp: '2026-11-08T10:01:00Z' }),
      msg({ id: '3', sender: 'Me', sender_id: 'me', target_name: 'ana', timestamp: '2026-11-08T10:02:00Z' }),
      msg({ id: '4', channel: 'local', sender: 'Cy', sender_id: 'p-cy' }),
    ], 'me')
    expect(list.map((c) => [c.name, c.id, c.last.id])).toEqual([['ana', 'p-ana', '3'], ['Bo', 'Bo', '2']])
  })

  it('lists recent contacts without the player and without duplicates', () => {
    const contacts = recentContacts([
      msg({ channel: 'local', sender: 'Cy', sender_id: 'p-cy' }),
      msg({ channel: 'system', sender: 'Ana', sender_id: 'p-ana' }),
      msg({ sender: 'Me', sender_id: 'me', target_name: 'Cy' }),
      msg({ channel: 'faction', sender: 'Dee', sender_id: 'p-dee' }),
    ], 'me')
    expect(contacts).toEqual(['Cy', 'Ana'])
  })
})
