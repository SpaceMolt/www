import { expect, mock, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as bindings from '@/lib/spacemolt'
import * as play from '../../PlayProvider'
import { ShipCatalog } from './ShipCatalog'

test('mobile bases show faction commission guidance instead of the personal commission button', () => {
  const ships = [
    { id: 'siege_foundry', name: 'Siege Foundry', class: 'Mobile Base', tier: 5 },
    { id: 'viper', name: 'Viper', class: 'Fighter', tier: 1 },
  ]
  try {
    spyOn(bindings, 'useShip').mockReturnValue(undefined)
    spyOn(bindings, 'useCargo').mockReturnValue([])
    spyOn(bindings, 'usePlayer').mockReturnValue(undefined)
    spyOn(bindings, 'useLocationState').mockReturnValue({ docked_at: 'faction_yard' })
    spyOn(bindings, 'useCommandMutation').mockReturnValue(mock())
    spyOn(bindings, 'useCatalog').mockReturnValue({ data: { ships }, error: null })
    let query = 0
    spyOn(bindings, 'useCommandQuery').mockImplementation(() => ({
      data: query++ === 0 ? new Set(ships.map((ship) => ship.id)) : undefined,
      loading: false, error: null, errorCode: null, refetch: () => {},
    }))
    spyOn(play, 'usePlay').mockReturnValue({ uiStore: { dispatch: () => {} } })

    const html = renderToStaticMarkup(<ShipCatalog />)
    expect(html).not.toContain('Commission this faction station')
    expect(html.match(/title="Commission this ship"/g)).toHaveLength(1)
    expect(html).toContain('commission_ship')
    expect(html).toContain('ship_class=siege_foundry fund_from_faction=true')
    expect(html).toContain('faction storage and treasury')
  } finally {
    mock.restore()
  }
})
