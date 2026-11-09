import { expect, mock, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as bindings from '@/lib/spacemolt'
import * as play from '../../PlayProvider'
import { ShipCatalog } from './ShipCatalog'

test('mobile bases the server lists as commissionable show the Commission chip, not agent-only guidance', () => {
  const ships = [
    { id: 'siege_foundry', name: 'Siege Foundry', class: 'Mobile Base', tier: 5, piloting_required: 50 },
    { id: 'viper', name: 'Viper', class: 'Fighter', tier: 1 },
  ]
  const commissionable = new Set(ships.map((ship) => ship.id))
  try {
    spyOn(bindings, 'useShip').mockReturnValue(undefined)
    spyOn(bindings, 'useCargo').mockReturnValue([])
    spyOn(bindings, 'usePlayer').mockReturnValue(undefined)
    spyOn(bindings, 'useSkills').mockReturnValue(undefined)
    spyOn(bindings, 'useStations').mockReturnValue({ data: null, error: null })
    spyOn(bindings, 'useLocationState').mockReturnValue({ docked_at: 'faction_yard' })
    spyOn(bindings, 'useCommandMutation').mockReturnValue(mock())
    spyOn(bindings, 'useCatalog').mockReturnValue({ data: { ships }, error: null })
    // Every query sees the commissionable set; the other queries read no fields off a Set.
    spyOn(bindings, 'useCommandQuery').mockImplementation(() => ({
      data: commissionable, loading: false, error: null, errorCode: null, refetch: () => {},
    }))
    spyOn(play, 'usePlay').mockReturnValue({ uiStore: { dispatch: () => {} } })

    const html = renderToStaticMarkup(<ShipCatalog />)
    expect(html).not.toContain('Commission this faction station')
    expect(html.match(/title="You can commission this ship here"/g)).toHaveLength(2)
    // The server's commissionable set clears the client-side piloting block.
    expect(html).not.toContain('Needs Piloting')
    expect(html).not.toContain('Commission through your agent')
  } finally {
    mock.restore()
  }
})
