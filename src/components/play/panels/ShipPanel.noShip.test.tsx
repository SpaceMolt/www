import { expect, mock, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as bindings from '@/lib/spacemolt'
import * as play from '../PlayProvider'
import { ShipPanel } from './ShipPanel'

// A pilot who disembarked has no ship. The Ship panel must offer the ships they
// own here, with a Switch button, instead of a dead end (reported by @FloorIsTired).
test('a pilot with no ship gets their docked ships with Switch in the Ship panel', () => {
  const fleet = {
    count: 1,
    ships: [{ ship_id: 'frost1', class_id: 'frost_dividend', class_name: 'Frost Dividend', is_active: false, location_base_id: 'market_prime_exchange' }],
  }
  try {
    spyOn(bindings, 'useShip').mockReturnValue(undefined)
    spyOn(bindings, 'useModules').mockReturnValue(undefined)
    spyOn(bindings, 'useCargo').mockReturnValue(undefined)
    spyOn(bindings, 'usePlayer').mockReturnValue(undefined)
    spyOn(bindings, 'usePendingAction').mockReturnValue(null)
    spyOn(bindings, 'useLocationState').mockReturnValue({ docked_at: 'market_prime_exchange' })
    spyOn(bindings, 'useStations').mockReturnValue({ data: [{ base_id: 'market_prime_exchange', services: ['shipyard'] }], error: null })
    spyOn(bindings, 'useCatalog').mockReturnValue({ data: null, error: null })
    spyOn(bindings, 'useCommandMutation').mockReturnValue(mock())
    spyOn(bindings, 'useAccountStore').mockReturnValue({ account: {} })
    spyOn(bindings, 'useCommandQuery').mockReturnValue({ data: fleet, loading: false, error: null, errorCode: null, refetch: () => {} })
    spyOn(play, 'usePlay').mockReturnValue({ uiStore: { dispatch: () => {} } })
    spyOn(play, 'usePlayUi').mockReturnValue(0)

    const html = renderToStaticMarkup(<ShipPanel />)
    expect(html).not.toContain('No ship data available')
    expect(html).toContain('Frost Dividend')
    expect(html).toContain('title="Switch to this ship"')
  } finally {
    mock.restore()
  }
})
