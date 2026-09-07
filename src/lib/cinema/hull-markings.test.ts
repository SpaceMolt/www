import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { findHullMarkingPlacements, hullMarkingText, addHullMarkings } from './hull-markings'

function box(name = 'hull') {
  const model = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, .3, .5), new THREE.MeshStandardMaterial())
  mesh.name = name; model.add(mesh)
  return { model, mesh }
}
describe('painted hull names', () => {
  test('safe text retains Unicode without controls or broken code points', () => {
    expect(hullMarkingText('  LT1428\n  海燕\u202e ')).toBe('LT1428 海燕')
    expect(Array.from(hullMarkingText('𐐀'.repeat(60)))).toHaveLength(48)
    expect(hullMarkingText('e\u0301')).toBe('é')
    expect(hullMarkingText(' \u0001 ')).toBe('')
  })
  test('names sit on both actual hull sides, upright and bounded in physical size', () => {
    for (const worldSize of [16.2, 179, 362]) {
      const { model } = box()
      const placements = findHullMarkingPlacements(model, worldSize, 6)
      expect(placements).toHaveLength(2)
      for (const p of placements) {
        expect(Math.abs(p.position.z)).toBeCloseTo(.25 + .008 / worldSize, 5)
        expect(p.height * worldSize).toBeLessThanOrEqual(8)
        expect(new THREE.Vector3(0, 1, 0).applyQuaternion(p.rotation).y).toBeCloseTo(1)
        expect(p.width / p.height).toBeCloseTo(6)
      }
    }
  })
  test('windows and weapon geometry are never supporting surfaces', () => {
    expect(findHullMarkingPlacements(box('windows').model, 180, 6)).toEqual([])
    const { model, mesh } = box()
    mesh.geometry.setAttribute('cinemaMount', new THREE.Float32BufferAttribute(new Float32Array(mesh.geometry.getAttribute('position').count).fill(0), 1))
    expect(findHullMarkingPlacements(model, 180, 6)).toEqual([])
  })
  test('occluding equipment prevents floating labels over it', () => {
    const { model } = box()
    for (const side of [-1, 1]) {
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, .3, .02), new THREE.MeshStandardMaterial())
      blocker.name = 'metal'; blocker.position.z = side * .3; model.add(blocker)
    }
    expect(findHullMarkingPlacements(model, 180, 6)).toEqual([])
  })
  test('deterministic placement, invalid sizing and server rendering fail safely', () => {
    const { model } = box()
    expect(findHullMarkingPlacements(model, 180, 6)).toEqual(findHullMarkingPlacements(model, 180, 6))
    expect(findHullMarkingPlacements(model, NaN, 6)).toEqual([])
    expect(findHullMarkingPlacements(model, 180, Infinity)).toEqual([])
    expect(addHullMarkings(model, { name: 'Example', empire: 'solarian', worldSize: 180, seed: 1 })).toBe(false)
  })
})


test('paint owns a single texture and material, is lit, and disposes without leaking', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const context = {
    measureText: () => ({ width: 400 }), fillText: () => {}, setTransform: () => {},
    resetTransform: () => {}, fillRect: () => {},
  }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } })
  try {
    const { model } = box()
    expect(addHullMarkings(model, { name: 'A named ship', empire: 'solarian', worldSize: 180, seed: 1 })).toBe(true)
    const paint = model.children.filter(child => child.userData.hullMarking) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[]
    expect(paint).toHaveLength(2)
    expect(paint[0].material).toBe(paint[1].material)
    expect(paint[0].material.emissive.getHex()).toBe(0)
    expect(paint[0].castShadow).toBe(false)
    let disposed = 0
    paint[0].material.map!.addEventListener('dispose', () => disposed++)
    paint[0].material.dispose()
    expect(disposed).toBe(1)
    expect(addHullMarkings(model, { name: 'Again', empire: 'solarian', worldSize: 180, seed: 1 })).toBe(false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})


test('large free panels support larger names while small hull lettering stays unchanged', () => {
  const small = findHullMarkingPlacements(box().model, 16.2, 6)[0]
  const capital = findHullMarkingPlacements(box().model, 362, 6)[0]
  expect(small.height * 16.2).toBeCloseTo(.35)
  expect(capital.height * 362).toBeGreaterThan(6)
  expect(capital.height * 362).toBeLessThanOrEqual(8)
  expect(capital.width).toBeLessThan(.34)
})

test('an isolated narrow panel falls back to smaller paint without overlapping surrounding equipment', () => {
  const { model } = box('metal')
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(.026, .03, .02), new THREE.MeshStandardMaterial())
    panel.name = 'armor'; panel.position.set(.12, 0, side * .26); model.add(panel)
  }
  const placements = findHullMarkingPlacements(model, 362, 6)
  expect(placements).toHaveLength(2)
  for (const p of placements) {
    expect(p.height * 362).toBeCloseTo(1.4)
    expect(p.width).toBeLessThan(.026)
    expect(Math.abs(p.position.x - .12) + p.width / 2).toBeLessThan(.026 / 2)
    expect(Math.abs(p.position.z)).toBeCloseTo(.27 + .008 / 362)
  }
})


test('a later broad panel wins over the first narrow registration patch', () => {
  const { model } = box('metal')
  for (const side of [-1, 1]) for (const [x, width] of [[.12, .026], [-.12, .3]]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, .1, .02), new THREE.MeshStandardMaterial())
    panel.name = 'armor'; panel.position.set(x, 0, side * .26); model.add(panel)
  }
  const placements = findHullMarkingPlacements(model, 362, 6)
  expect(placements).toHaveLength(2)
  for (const p of placements) {
    expect(p.position.x).toBeCloseTo(-.12)
    expect(p.height * 362).toBeGreaterThan(6)
  }
})

test('an interior obstruction between support probes prevents paint crossing equipment', () => {
  const { model } = box()
  const baseline = findHullMarkingPlacements(model, 362, 6)
  expect(baseline).toHaveLength(2)
  // Place blockers between probe columns on every candidate panel, including
  // every fallback size. None lies exactly on a support-grid ray.
  for (const side of [-1, 1]) for (const x of [.12, -.12, .28, -.28, 0]) for (const y of [0, -.18 * .3, .18 * .3]) {
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(.001, .025, .012), new THREE.MeshStandardMaterial())
    blocker.name = 'metal'; blocker.position.set(x + .0015, y, side * .251); model.add(blocker)
  }
  expect(findHullMarkingPlacements(model, 362, 6)).toEqual([])
})


test('protrusions inside the same merged armor batch also block the full footprint', () => {
  const { model, mesh } = box()
  const pieces = [mesh.geometry]
  for (const side of [-1, 1]) for (const x of [.12, -.12, .28, -.28, 0]) for (const y of [0, -.18 * .3, .18 * .3]) {
    pieces.push(new THREE.BoxGeometry(.001, .025, .012).translate(x + .0015, y, side * .251))
  }
  mesh.geometry = mergeGeometries(pieces)!
  pieces.forEach(piece => piece.dispose())
  expect(findHullMarkingPlacements(model, 362, 6)).toEqual([])
})

test('equipment on the opposite side of the hull does not block front-side paint', () => {
  const { model } = box()
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, .3, .02), new THREE.MeshStandardMaterial())
  blocker.name = 'metal'; blocker.position.z = -.3; model.add(blocker)
  const placements = findHullMarkingPlacements(model, 362, 6)
  expect(placements).toHaveLength(1)
  expect(placements[0].position.z).toBeGreaterThan(0)
  expect(placements[0].height * 362).toBeGreaterThan(6)
})
