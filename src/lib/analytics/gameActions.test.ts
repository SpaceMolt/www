import { describe, expect, test } from 'bun:test'
import { instrumentCommands, TRACKED_COMMANDS, type GameActionEvent } from './gameActions'

/** Minimal stand-in for the two-level Account command facade. */
function fakeCommands(overrides: Record<string, Record<string, unknown>> = {}) {
  return {
    spacemolt: {
      undock: async () => ({ delta: { details: { message: 'undocked' } } }),
      get_system: async () => ({ id: 'sol' }),
      version: '2',
      ...overrides.spacemolt,
    },
    spacemolt_salvage: {
      sell: async () => ({ ok: true }),
      ...overrides.spacemolt_salvage,
    },
  }
}

function recorder() {
  const events: GameActionEvent[] = []
  return { events, emit: (e: GameActionEvent) => events.push(e) }
}

/** Deterministic clock so duration_ms is assertable. */
function clock(...ticks: number[]) {
  let i = 0
  return () => ticks[Math.min(i++, ticks.length - 1)] ?? 0
}

describe('instrumentCommands', () => {
  test('emits game_action for a tracked mutation', async () => {
    const { events, emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit, clock(1000, 1412))

    await commands.spacemolt.undock()

    expect(events).toEqual([
      { command: 'undock', namespace: 'spacemolt', outcome: 'ok', duration_ms: 412 },
    ])
  })

  test('emits outcome error and re-throws when a command rejects', async () => {
    const { events, emit } = recorder()
    const boom = new Error('not docked')
    const commands = instrumentCommands(
      fakeCommands({ spacemolt: { undock: async () => { throw boom } } }),
      emit,
      clock(1000, 1050),
    )

    await expect(commands.spacemolt.undock()).rejects.toThrow('not docked')
    expect(events).toEqual([
      { command: 'undock', namespace: 'spacemolt', outcome: 'error', duration_ms: 50 },
    ])
  })

  test('stays silent for untracked read commands', async () => {
    const { events, emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit)

    await commands.spacemolt.get_system()

    expect(events).toEqual([])
  })

  test('captures no argument values', async () => {
    const { events, emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit)

    // A note body is the worst case: player-authored free text through a
    // tracked command. Nothing but the name may reach analytics.
    await commands.spacemolt.undock({ secret: 'my private note body' })

    expect(events).toHaveLength(1)
    expect(JSON.stringify(events[0])).not.toContain('private note body')
    expect(Object.keys(events[0]!).sort()).toEqual(['command', 'duration_ms', 'namespace', 'outcome'])
  })

  test('disambiguates same-named commands across namespaces', async () => {
    const { events, emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit)

    await commands.spacemolt_salvage.sell()

    expect(events[0]).toMatchObject({ command: 'sell', namespace: 'spacemolt_salvage' })
  })

  test('passes return values through unchanged', async () => {
    const { emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit)

    expect(await commands.spacemolt.undock()).toEqual({ delta: { details: { message: 'undocked' } } })
    expect(await commands.spacemolt.get_system()).toEqual({ id: 'sol' })
  })

  test('passes non-function properties through untouched', () => {
    const { emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit)

    expect(commands.spacemolt.version).toBe('2')
  })

  test('returns stable references so call-site memo deps do not thrash', () => {
    const { emit } = recorder()
    const commands = instrumentCommands(fakeCommands(), emit)

    expect(commands.spacemolt).toBe(commands.spacemolt)
    expect(commands.spacemolt.undock).toBe(commands.spacemolt.undock)
  })

  test('every tracked command is namespace-qualified', () => {
    for (const name of TRACKED_COMMANDS) {
      expect(name).toMatch(/^spacemolt(_[a-z_]+)?\.[a-z_]+$/)
    }
  })
})
