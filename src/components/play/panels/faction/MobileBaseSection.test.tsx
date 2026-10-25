import { expect, mock, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FactionInfoResponse, MobileBaseInfo } from '@spacemolt/lib'
import * as bindings from '@/lib/spacemolt'
import * as play from '../../PlayProvider'
import { MobileBaseSection } from './MobileBaseSection'

const base: MobileBaseInfo = {
  archetype_id: 'civitas', base_id: 'drft_civitas', poi_id: 'drft_civitas', name: 'Civitas',
  lifecycle: 'stationary', current_system_id: 'sol', current_position: { x: 1, y: 2 },
  origin: { system_id: '', position: { x: 0, y: 0 } }, destination: { system_id: '', position: { x: 0, y: 0 } },
  state_started_tick: 0, state_complete_tick: 0, wrecked: false,
}
const systems: Record<string, { name: string; connections: string[] }> = {
  sol: { name: 'Sol', connections: ['sirius'] },
  sirius: { name: 'Sirius', connections: ['sol'] },
}

function render(mobileBase: MobileBaseInfo, playerId = 'lead') {
  try {
    spyOn(bindings, 'useCommandMutation').mockReturnValue(mock())
    spyOn(bindings, 'useCurrentTick').mockReturnValue(370)
    spyOn(bindings, 'useMap').mockReturnValue({ data: { system: (id: string) => systems[id] } as never, error: null })
    spyOn(play, 'usePlay').mockReturnValue({ uiStore: { dispatch: () => {} } } as never)
    const info = { leader_id: 'lead', members: [{ player_id: 'grunt', role: 'Member' }], roles: [{ id: 'member', name: 'Member', priority: 0, permissions: { manage_bases: false } }], mobile_base: mobileBase } as unknown as FactionInfoResponse
    return renderToStaticMarkup(<MobileBaseSection info={info} playerId={playerId} onChanged={() => {}} />)
  } finally {
    mock.restore()
  }
}

test('a parked base offers move, adjacent-system jump and decommission to managers', () => {
  const html = render(base)
  expect(html).toContain('Holding position')
  expect(html).toContain('1.00, 2.00 AU')
  expect(html).toContain('<option value="sirius">Sirius</option>')
  expect(html).toContain('Decommission')
})

test('members without manage_bases see status only', () => {
  const html = render(base, 'grunt')
  expect(html).toContain('Holding position')
  expect(html).not.toContain('Jump destination')
  expect(html).not.toContain('Decommission')
})

test('a jumping base shows its lane and arrival countdown', () => {
  const html = render({
    ...base, lifecycle: 'jumping', current_system_id: '',
    origin: { system_id: 'sol', position: { x: 1, y: 2 } }, destination: { system_id: 'sirius', position: { x: 0, y: 0 } },
    state_started_tick: 100, state_complete_tick: 640,
  })
  expect(html).toContain('Sol → Sirius')
  expect(html).toContain('~45m (50%)')
  expect(html).not.toContain('Move within system')
})

test('a jump in preparation can be cancelled', () => {
  const html = render({
    ...base, lifecycle: 'jump_preparing',
    origin: { system_id: 'sol', position: { x: 1, y: 2 } }, destination: { system_id: 'sirius', position: { x: 0, y: 0 } },
    state_started_tick: 300, state_complete_tick: 390,
  })
  expect(html).toContain('Sol → Sirius')
  expect(html).toContain('Cancel jump')
})
