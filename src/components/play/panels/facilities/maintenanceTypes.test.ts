/**
 * Unit tests for the maintenance-input extractor used by FacilityCard.
 *
 * The extractor accepts whatever the `facility_types` endpoint returned and
 * tolerates missing/garbage fields, since the API is loosely typed at the
 * call boundary (callStructured returns `unknown`).
 */
import { test, expect } from 'bun:test'
import {
  extractMaintenanceInputs,
  type FacilityTypeMaintenanceDetail,
} from './maintenanceTypes'

test('returns empty array for null/undefined', () => {
  expect(extractMaintenanceInputs(null)).toEqual([])
  expect(extractMaintenanceInputs(undefined)).toEqual([])
})

test('returns empty array when maintenance_per_cycle is missing', () => {
  expect(extractMaintenanceInputs({ type_id: 'foo' })).toEqual([])
})

test('returns empty array when maintenance_per_cycle is not an array', () => {
  // The API should always return an array, but we want the helper to be
  // defensive against misbehaving servers / proxies.
  const bad = { maintenance_per_cycle: 'nope' } as unknown as FacilityTypeMaintenanceDetail
  expect(extractMaintenanceInputs(bad)).toEqual([])
})

test('extracts well-formed maintenance inputs', () => {
  const detail: FacilityTypeMaintenanceDetail = {
    type_id: 'auto_factory_i',
    maintenance_per_cycle: [
      { item_id: 'steel_plate', name: 'Steel Plate', quantity: 5 },
      { item_id: 'circuit_board', name: 'Circuit Board', quantity: 2 },
    ],
  }
  expect(extractMaintenanceInputs(detail)).toEqual([
    { item_id: 'steel_plate', name: 'Steel Plate', quantity: 5 },
    { item_id: 'circuit_board', name: 'Circuit Board', quantity: 2 },
  ])
})

test('drops malformed entries and zero/negative quantities', () => {
  const detail = {
    maintenance_per_cycle: [
      { item_id: 'steel_plate', name: 'Steel Plate', quantity: 5 },
      // missing name
      { item_id: 'fuel', quantity: 1 },
      // zero quantity should be filtered
      { item_id: 'water', name: 'Water', quantity: 0 },
      // negative quantity should be filtered
      { item_id: 'air', name: 'Air', quantity: -3 },
      // null entry
      null,
    ],
  } as unknown as FacilityTypeMaintenanceDetail
  expect(extractMaintenanceInputs(detail)).toEqual([
    { item_id: 'steel_plate', name: 'Steel Plate', quantity: 5 },
  ])
})

test('strips extra fields and only returns the canonical shape', () => {
  const detail = {
    maintenance_per_cycle: [
      { item_id: 'steel_plate', name: 'Steel Plate', quantity: 5, extra: 'ignored' },
    ],
  } as unknown as FacilityTypeMaintenanceDetail
  expect(extractMaintenanceInputs(detail)).toEqual([
    { item_id: 'steel_plate', name: 'Steel Plate', quantity: 5 },
  ])
})
