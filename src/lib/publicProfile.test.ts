import { afterEach, expect, test } from 'bun:test'
import { fetchFactionProfile, fetchRecentBattles, type ProfileBattle } from './publicProfile'
import { fetchPlayerAchievements } from './publicAchievements'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function battle(id: string, ended: string, participant = 'Pilot'): ProfileBattle {
  return {
    battle_id: id, system_id: 'sol', system_name: 'Sol', status: 'completed',
    duration_ticks: 10, participant_count: 2, ships_destroyed: 1,
    ended_at: `2026-09-07T${ended}:00Z`,
    sides: [{ side_id: 0, participants: [participant] }],
  }
}

test('recent player battles include wildlife and arena, sort together, deduplicate and require exact membership', async () => {
  const urls: URL[] = []
  const duplicate = battle('duplicate', '12:00')
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input))
    urls.push(url)
    const category = url.searchParams.get('category')
    const battles = category === 'wildlife'
      ? [battle('creature', '16:00'), duplicate]
      : category === 'arena'
        ? [battle('arena', '15:00'), duplicate]
        : [battle('substring', '18:00', 'PilotTwo'), battle('pvp', '14:00'), battle('pirate', '13:00'), duplicate, battle('old', '11:00')]
    return Response.json({ battles })
  }) as typeof fetch
  expect((await fetchRecentBattles('Pilot')).map(b => b.battle_id)).toEqual([
    'creature', 'arena', 'pvp', 'pirate', 'duplicate',
  ])
  expect(urls).toHaveLength(3)
  expect(urls.every(url => url.searchParams.get('search') === 'Pilot')).toBe(true)
})

test('failure of one battle category does not hide available player history', async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const category = new URL(String(input)).searchParams.get('category')
    if (category === 'arena') return new Response('unavailable', { status: 503 })
    if (category === 'wildlife') return Response.json({ battles: [battle('creature', '16:00')] })
    return Response.json({ battles: null })
  }) as typeof fetch
  expect((await fetchRecentBattles('Pilot')).map(b => b.battle_id)).toEqual(['creature'])
})

// dc#096114: a rate limit or outage must not render (and cache) "no such faction".
test('only a gameserver 404 means not found; other failures throw', async () => {
  globalThis.fetch = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
  expect(await fetchFactionProfile('NONE')).toBeNull()
  expect(await fetchPlayerAchievements('nobody')).toBeNull()
  globalThis.fetch = (async () => new Response('', { status: 429 })) as unknown as typeof fetch
  await expect(fetchFactionProfile('KST3')).rejects.toThrow()
  await expect(fetchPlayerAchievements('Pilot')).rejects.toThrow()
  globalThis.fetch = (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
  await expect(fetchFactionProfile('KST3')).rejects.toThrow()
})
