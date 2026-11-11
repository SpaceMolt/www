import { expect, mock, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as bindings from '@/lib/spacemolt'
import * as play from '../../PlayProvider'
import { CommissionsView } from './CommissionsView'

test('a credit-paid commission still sourcing offers the Supply action at its station', () => {
  const commission = {
    commission_id: 'c1',
    ship_name: 'Viper',
    status: 'sourcing',
    base_id: 'sol_central',
    base_name: 'Sol Central',
    credits_paid: 12000,
    materials_provided: false,
    source_missing_materials: true,
    required_materials: { steel_plate: 10 },
    materials_gathered: { steel_plate: 4 },
  }
  try {
    spyOn(bindings, 'useCommandMutation').mockReturnValue(mock())
    spyOn(bindings, 'useLocationState').mockReturnValue({ docked_at: 'sol_central' })
    spyOn(bindings, 'useCurrentTick').mockReturnValue(0)
    spyOn(bindings, 'useCommandQuery').mockReturnValue({
      data: { commissions: [commission] }, loading: false, error: null, errorCode: null, refetch: () => {},
    })
    spyOn(play, 'usePlay').mockReturnValue({ uiStore: { dispatch: () => {} } })

    const html = renderToStaticMarkup(<CommissionsView />)
    expect(html).toContain('The yard is buying these materials')
    expect(html).toContain('title="Supply this material from your cargo/storage"')
  } finally {
    mock.restore()
  }
})
