import { expect, test } from 'bun:test'
import { errorMessage, stripErrorCode } from './errorMessage'

test('errorMessage strips a leading snake_case code', () => {
  expect(errorMessage(new Error('no_fuel_cells: No fuel cells in cargo.'))).toBe('No fuel cells in cargo.')
  expect(errorMessage(new Error('Note: keep this'))).toBe('Note: keep this')
  expect(errorMessage(new Error('Cannot dock'))).toBe('Cannot dock')
  expect(errorMessage('x')).toBe('Action failed')
})

test('stripErrorCode turns a bare code into words', () => {
  expect(stripErrorCode('cargo_full')).toBe('Cargo full')
  expect(stripErrorCode('Not enough space')).toBe('Not enough space')
})
