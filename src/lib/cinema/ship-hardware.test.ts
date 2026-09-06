import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { createShip } from './ships'
import { resolveAppearance } from './appearance'
import { aimWeaponMount, canAimWeaponMount, weaponMuzzleLocal, type WeaponRig } from './ship-weapons'

function weapons(group: THREE.Group) {
  const rig = group.userData.weaponRig as WeaponRig
  const vertices = rig.mounts.map(() => [] as number[])
  for (const child of group.children as THREE.Mesh[]) {
    const positions = child.geometry.getAttribute('position'), tags = child.geometry.getAttribute('cinemaMount')
    if (!tags) continue
    for (let i = 0; i < positions.count; i++) {
      const index = tags.getX(i)
      if (index >= 0) vertices[index].push(positions.getX(i), positions.getY(i), positions.getZ(i))
    }
  }
  return vertices.map((positions, index) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    mesh.updateMatrixWorld(true)
    let radius = 0
    const point = new THREE.Vector3(), attribute = geometry.getAttribute('position')
    for (let i = 0; i < attribute.count; i++) radius = Math.max(radius, point.fromBufferAttribute(attribute, i).distanceTo(rig.mounts[index].pivot))
    return { mesh, radius, pivot: rig.mounts[index].pivot }
  })
}
function dispose(group: THREE.Group) {
  const materials = new Set<THREE.Material>()
  for (const child of group.children as THREE.Mesh[]) {
    child.geometry.dispose()
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material)
    if (child.customDepthMaterial) materials.add(child.customDepthMaterial)
    if (child.customDistanceMaterial) materials.add(child.customDistanceMaterial)
  }
  materials.forEach(material => material.dispose())
}
const heavyFit = { source: 'modules' as const, weapons: { autocannon: 1, kinetic: 2, railgun: 4 }, cargo: 0, mining: 0, salvage: 0, sensor: 0, defense: 0, utility: 0 }

test('Devastator representative guns reserve disjoint physical volumes through independent traverse', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'crimson', 4, 'Combat', 4), 90210, 'hero', heavyFit)
  const actual = weapons(group)
  try {
    expect(actual.length).toBeGreaterThanOrEqual(3)
    const rig = group.userData.weaponRig as WeaponRig
    expect(new Set(rig.mounts.map(mount => mount.family))).toEqual(new Set(['autocannon', 'kinetic', 'railgun']))
    const overlaps: { a: number; b: number; overlap: number }[] = []
    for (let a = 0; a < actual.length; a++) for (let b = a + 1; b < actual.length; b++) {
      const overlap = actual[a].radius + actual[b].radius - actual[a].pivot.distanceTo(actual[b].pivot)
      if (overlap > -.001) overlaps.push({ a, b, overlap })
    }
    // Measured from the actual triangles, these swept spheres guarantee that
    // independently aimed guns cannot touch, even with different simultaneous targets.
    expect(overlaps.slice(0, 3)).toEqual([])
    for (const mount of actual) expect(mount.pivot.length() + mount.radius).toBeLessThan(.78)
  } finally {
    actual.forEach(({ mesh }) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
    dispose(group)
  }
})

test('Devastator gun triangles do not physically intersect in their construction pose', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'crimson', 4, 'Combat', 4), 90210, 'hero', heavyFit)
  const actual = weapons(group), ray = new THREE.Raycaster(), start = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3()
  const collisions: number[][] = []
  try {
    for (let a = 0; a < actual.length; a++) for (let b = a + 1; b < actual.length; b++) {
      if (!new THREE.Box3().setFromObject(actual[a].mesh).intersectsBox(new THREE.Box3().setFromObject(actual[b].mesh))) continue
      const positions = actual[a].mesh.geometry.getAttribute('position')
      let intersects = false
      for (let triangle = 0; triangle < positions.count && !intersects; triangle += 3) for (let edge = 0; edge < 3 && !intersects; edge++) {
        start.fromBufferAttribute(positions, triangle + edge)
        end.fromBufferAttribute(positions, triangle + (edge + 1) % 3)
        const length = direction.subVectors(end, start).length()
        if (length < .00001) continue
        direction.divideScalar(length)
        ray.set(start.clone().addScaledVector(direction, .000001), direction)
        ray.far = length - .000002
        intersects = ray.intersectObject(actual[b].mesh, false).length > 0
      }
      if (intersects) collisions.push([a, b])
    }
    expect(collisions).toEqual([])
  } finally {
    actual.forEach(({ mesh }) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
    dispose(group)
  }
})


test('Devastator admitted discharges clear the superstructure and structural sponsons', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'crimson', 4, 'Combat', 4), 90210, 'hero', heavyFit)
  try {
    group.updateMatrixWorld(true)
    const rig = group.userData.weaponRig as WeaponRig
    const hull = group.children.filter(object => !object.userData.engine && !object.userData.retrothruster) as THREE.Mesh[]
    for (const mesh of hull) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.side = THREE.DoubleSide
    const ray = new THREE.Raycaster(), failures: { mount: number; yaw: number; pitch: number; surface: string }[] = []
    let admitted = 0
    for (let index = 0; index < rig.mounts.length; index++) for (let yaw = -180; yaw < 180; yaw += 15) for (const pitch of [-90, -45, -15, -5, 0, 5, 15, 45, 90]) {
      const heading = THREE.MathUtils.degToRad(yaw), elevation = THREE.MathUtils.degToRad(pitch)
      const direction = new THREE.Vector3(Math.cos(heading) * Math.cos(elevation), Math.sin(elevation), Math.sin(heading) * Math.cos(elevation))
      const target = rig.mounts[index].pivot.clone().addScaledVector(direction, 10)
      if (!canAimWeaponMount(rig, index, target)) continue
      admitted++
      aimWeaponMount(rig, index, target)
      const muzzle = weaponMuzzleLocal(rig, index)!
      ray.set(muzzle.clone().addScaledVector(direction, .0001), direction)
      const blocked = ray.intersectObjects(hull, false).find(hit => {
        if (!hit.face) return false
        const tag = (hit.object as THREE.Mesh).geometry.getAttribute('cinemaMount')
        return !tag || [hit.face.a, hit.face.b, hit.face.c].every(vertex => tag.getX(vertex) < 0)
      })
      if (blocked) failures.push({ mount: index, yaw, pitch, surface: blocked.object.name })
    }
    expect(admitted).toBeGreaterThan(400)
    expect(failures).toEqual([])
  } finally { dispose(group) }
})

test('heavy empire hulls keep maximum-size mechanisms separate without shrinking the guns', () => {
  const families = ['railgun', 'autocannon', 'kinetic', 'flak', 'laser', 'beam', 'plasma', 'torpedo', 'missile', 'exotic', 'disruptor', 'mine', 'smartbomb'] as const
  const failures: string[] = []
  for (const empire of ['crimson', 'solarian', 'voidborn', 'nebula', 'outerrim'] as const) for (const family of families) {
    const group = createShip(resolveAppearance('Dreadnought', empire, 5, 'Combat', 5), 23, 'hero', { ...heavyFit, weapons: { [family]: 8 } })
    const actual = weapons(group)
    try {
      expect(actual.length).toBeGreaterThan(0)
      for (let a = 0; a < actual.length; a++) {
        if (actual[a].pivot.length() + actual[a].radius >= .78) failures.push(`${empire}/${family}/${a}: camera bounds`)
        for (let b = a + 1; b < actual.length; b++) {
          if (actual[a].pivot.distanceTo(actual[b].pivot) <= actual[a].radius + actual[b].radius + .001) failures.push(`${empire}/${family}/${a}/${b}: overlapping sweep`)
        }
      }
      if (family === 'railgun') {
        const rig = group.userData.weaponRig as WeaponRig
        // The oversized barrels remain oversized; sparse mounts create room.
        expect(rig.mounts[0].muzzle.distanceTo(rig.mounts[0].pivot)).toBeGreaterThan(.3)
      }
    } finally {
      actual.forEach(({ mesh }) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
      dispose(group)
    }
  }
  expect(failures).toEqual([])
})
