import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { bakeShipTemplateGeometry } from './ship-template'
import { createShip } from './ships'
import { resolveAppearance } from './appearance'
import { tagWeaponGeometry } from './ship-weapons'

test('fleet templates preserve normalized component paint and multiply the material tint', () => {
  const source = tagWeaponGeometry(new THREE.BoxGeometry(1, 1, 1), 0)
  const values = new Uint8Array(source.getAttribute('position').count * 3)
  for (let i = 0; i < values.length; i += 3) values.set([96, 128, 224], i)
  source.setAttribute('color', new THREE.BufferAttribute(values, 3, true))
  const tint = new THREE.Color().setRGB(.5, .25, .75)
  const baked = bakeShipTemplateGeometry(source, { color: tint, vertexColors: true }, new THREE.Matrix4().makeTranslation(2, 0, 0))
  try {
    const color = baked.getAttribute('color')
    for (let i = 0; i < color.count; i++) {
      expect(color.getX(i)).toBeCloseTo(96 / 255 * .5, 7)
      expect(color.getY(i)).toBeCloseTo(128 / 255 * .25, 7)
      expect(color.getZ(i)).toBeCloseTo(224 / 255 * .75, 7)
    }
    expect(baked.index).toBeNull()
    expect(Object.keys(baked.attributes).sort()).toEqual(['color', 'normal', 'position'])
    expect(source.getAttribute('cinemaMount')).toBeDefined()
    expect(source.getAttribute('color').array).toEqual(values)
    baked.computeBoundingBox()
    expect(baked.boundingBox!.min.x).toBeCloseTo(1.5, 8)
  } finally { source.dispose(); baked.dispose() }
})

test('plain materials ignore inactive vertex attributes when baking fleet color', () => {
  const source = new THREE.BoxGeometry(1, 1, 1)
  source.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(source.getAttribute('position').count * 3), 3))
  const baked = bakeShipTemplateGeometry(source, { color: new THREE.Color().setRGB(.2, .4, .6), vertexColors: false }, new THREE.Matrix4())
  try { expect(baked.getAttribute('color').getY(0)).toBeCloseTo(.4, 7) }
  finally { source.dispose(); baked.dispose() }
})

test('actual distant pirate and Outer Rim hulls retain their paint through fleet batching', () => {
  for (const empire of ['outerrim', 'pirate'] as const) {
    const model = createShip(resolveAppearance('Freighter', empire), 31, 'distant')
    model.updateMatrixWorld(true)
    const hull = model.children.find(child => child.name === 'hull') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    const baked = bakeShipTemplateGeometry(hull.geometry, hull.material, hull.matrixWorld)
    try {
      expect(hull.material.color.toArray()).toEqual([1, 1, 1])
      const original = hull.geometry.getAttribute('color'), color = baked.getAttribute('color')
      expect(color.getX(0)).toBeCloseTo(original.getX(0), 7)
      expect(color.getY(0)).toBeCloseTo(original.getY(0), 7)
      expect(color.getZ(0)).toBeCloseTo(original.getZ(0), 7)
      expect(Math.max(color.getX(0), color.getY(0), color.getZ(0))).toBeLessThan(.8)
    } finally {
      baked.dispose()
      const disposed = new Set<THREE.BufferGeometry | THREE.Material>()
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        for (const resource of [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material]), object.customDepthMaterial, object.customDistanceMaterial]) {
          if (resource && !disposed.has(resource)) { disposed.add(resource); resource.dispose() }
        }
      })
    }
  }
})
