import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { createShip } from './ships'
import { resolveAppearance } from './appearance'
import { buildFittedHardware, weaponEnvelopesSeparate } from './ship-hardware'
import { aimWeaponMount, canAimWeaponMount, weaponMuzzleLocal, type WeaponRig } from './ship-weapons'

function weapons(group: THREE.Group) {
  const rig = group.userData.weaponRig as WeaponRig
  const vertices = rig.mounts.map(() => [] as number[]), elevations = rig.mounts.map(() => [] as number[])
  for (const child of group.children as THREE.Mesh[]) {
    const positions = child.geometry.getAttribute('position'), tags = child.geometry.getAttribute('cinemaMount')
    if (!tags) continue
    for (let i = 0; i < positions.count; i++) {
      const index = tags.getX(i)
      if (index >= 0) {
        vertices[index].push(positions.getX(i), positions.getY(i), positions.getZ(i))
        elevations[index].push(child.geometry.getAttribute('cinemaElevation').getX(i))
      }
    }
  }
  return vertices.map((positions, index) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    mesh.updateMatrixWorld(true)
    let radius = 0, inward = 0
    const normal = rig.mounts[index].normal ?? new THREE.Vector3(0, 1, 0)
    const point = new THREE.Vector3(), attribute = geometry.getAttribute('position')
    for (let i = 0; i < attribute.count; i++) {
      point.fromBufferAttribute(attribute, i).sub(rig.mounts[index].pivot)
      radius = Math.max(radius, point.length())
      const height = point.dot(normal), x = point.x, depression = Math.PI / 36
      let minimum = height
      if (elevations[index][i] > .5) {
        minimum = Math.min(height * Math.cos(depression) - x * Math.sin(depression), x)
        const angle = Math.atan2(x, height) + Math.PI
        const stationary = Math.atan2(Math.sin(angle), Math.cos(angle))
        if (stationary >= -depression && stationary <= Math.PI / 2) minimum = Math.min(minimum, x * Math.sin(stationary) + height * Math.cos(stationary))
      }
      inward = Math.max(inward, -minimum)
    }
    // A free side gimbal can rotate its width inward too. The deck-only
    // elevation formula above is not a bound for this articulation.
    if (Math.abs(normal.y) < 1e-8 && Math.abs(normal.z) > 1 - 1e-8) inward = radius
    return { mesh, radius, inward, normal, elevation: elevations[index], pivot: rig.mounts[index].pivot }
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

test('opposed side gimbals reserve full rotation space on a narrow hull', () => {
  const mounted: THREE.Vector3[] = []
  buildFittedHardware({ ...heavyFit, weapons: { autocannon: 8 } }, 'capital', {
    appearance: resolveAppearance('Battlecruiser', 'solarian', 4, 'Combat', 4), hero: true, h: .1, w: .2,
    add: geometry => geometry.dispose(), slab: () => {}, rounded: () => {}, rod: () => {}, engine: () => {},
    deckAt: () => NaN,
    // Only two opposed physical sockets exist. Their deck-style inward caps
    // fit, but the freely gimballed side assemblies have overlapping spheres.
    hullSurface: (_point, normal) => Math.abs(normal.z) > .999 ? new THREE.Vector3(0, 0, Math.sign(normal.z) * .11) : undefined,
    beginWeapon: (_family, pivot) => { mounted.push(pivot.clone()) },
  })
  expect(mounted).toHaveLength(1)
})

test('opposed Axiomata side gimbals keep actual moving vertices in separated volumes', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'solarian', 4, 'Combat', 4), 90210, 'hero', { ...heavyFit, weapons: { beam: 3, laser: 3 }, defense: 4 })
  const actual = weapons(group), rig = group.userData.weaponRig as WeaponRig
  let pairs = 0
  try {
    for (let a = 0; a < actual.length; a++) for (let b = a + 1; b < actual.length; b++) {
      if (Math.abs(actual[a].normal.z) < .999 || actual[a].normal.dot(actual[b].normal) > -1 + 1e-8) continue
      pairs++
      const axis = actual[a].pivot.clone().sub(actual[b].pivot).normalize()
      const upper = actual[a].pivot.dot(axis) - actual[a].radius, lower = actual[b].pivot.dot(axis) + actual[b].radius
      expect(upper - lower).toBeGreaterThan(.001)
      const plane = (upper + lower) / 2
      for (let pose = 0; pose < 24; pose++) for (const index of [a, b]) {
        const mount = rig.mounts[index], normal = actual[index].normal
        const yaw = THREE.MathUtils.degToRad((index === a ? 1 : -1) * pose * 17), pitch = THREE.MathUtils.degToRad([-5, 0, 15, 45, 75, 90][pose % 6])
        const direction = new THREE.Vector3(1, 0, 0).applyAxisAngle(normal, yaw).multiplyScalar(Math.cos(pitch)).addScaledVector(normal, Math.sin(pitch))
        aimWeaponMount(rig, index, mount.pivot.clone().addScaledVector(direction, 10))
        const positions = actual[index].mesh.geometry.getAttribute('position')
        let gap = Infinity
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).sub(mount.pivot)
          point.applyQuaternion(actual[index].elevation[vertex] > .5 ? mount.rotation : mount.traverseRotation!).add(mount.pivot)
          gap = Math.min(gap, (point.dot(axis) - plane) * (index === a ? 1 : -1))
        }
        expect(gap).toBeGreaterThan(.0001)
      }
    }
    expect(pairs).toBeGreaterThan(0)
  } finally {
    actual.forEach(({ mesh }) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
    dispose(group)
  }
})

test('Axiomata side gun vertices move continuously through a broadside crossing', () => {
  // Public Axiomata catalog: Solarian Battlecruiser, scale/tier 4, three beam
  // and three laser modules. Exercise the assembled hardware, including bases.
  const group = createShip(resolveAppearance('Battlecruiser', 'solarian', 4, 'Combat', 4), 90210, 'hero', { ...heavyFit, weapons: { beam: 3, laser: 3 }, defense: 4 })
  const actual = weapons(group), rig = group.userData.weaponRig as WeaponRig
  let sideMounts = 0
  try {
    for (let index = 0; index < rig.mounts.length; index++) {
      const mount = rig.mounts[index]
      if (Math.abs(mount.normal!.z) < .999) continue
      sideMounts++
      aimWeaponMount(rig, index, mount.pivot.clone().addScaledVector(mount.normal!, 10).add(new THREE.Vector3(.01, 0, 0)))
      const beforeBase = mount.traverseRotation!.clone(), beforeBarrel = mount.rotation.clone()
      aimWeaponMount(rig, index, mount.pivot.clone().addScaledVector(mount.normal!, 10).add(new THREE.Vector3(-.01, 0, 0)))
      const positions = actual[index].mesh.geometry.getAttribute('position')
      let maximumMovement = 0
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).sub(mount.pivot), barrel = actual[index].elevation[vertex] > .5
        maximumMovement = Math.max(maximumMovement, point.clone().applyQuaternion(barrel ? beforeBarrel : beforeBase).distanceTo(point.applyQuaternion(barrel ? mount.rotation : mount.traverseRotation!)))
      }
      expect(maximumMovement).toBeLessThan(.002)
    }
    expect(sideMounts).toBeGreaterThanOrEqual(2)
  } finally {
    actual.forEach(({ mesh }) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
    dispose(group)
  }
})

test('Devastator representative guns reserve disjoint physical volumes through independent traverse', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'crimson', 4, 'Combat', 4), 90210, 'hero', heavyFit)
  const actual = weapons(group)
  try {
    expect(actual.length).toBeGreaterThanOrEqual(4)
    const rig = group.userData.weaponRig as WeaponRig
    expect(new Set(rig.mounts.map(mount => mount.family))).toEqual(new Set(['autocannon', 'kinetic', 'railgun']))
    const overlaps: { a: number; b: number; overlap: number }[] = []
    for (let a = 0; a < actual.length; a++) for (let b = a + 1; b < actual.length; b++) {
      const overlap = actual[a].radius + actual[b].radius - actual[a].pivot.distanceTo(actual[b].pivot)
      const opposedGap = actual[a].pivot.clone().sub(actual[b].pivot).dot(actual[a].normal) - actual[a].inward - actual[b].inward
      const opposite = actual[a].normal.dot(actual[b].normal) < -1 + 1e-8
      if (overlap > -.001 && !(opposite && opposedGap > .001)) overlaps.push({ a, b, overlap })
    }
    // Actual triangles determine both swept spheres and the inward caps.
    // Opposed caps use a separating plane; every other pair needs disjoint spheres.
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
          const opposed = actual[a].normal.dot(actual[b].normal) < -1 + 1e-8
          const gap = actual[a].pivot.clone().sub(actual[b].pivot).dot(actual[a].normal) - actual[a].inward - actual[b].inward
          if (actual[a].pivot.distanceTo(actual[b].pivot) <= actual[a].radius + actual[b].radius + .001 && !(opposed && gap > .001)) failures.push(`${empire}/${family}/${a}/${b}: overlapping sweep`)
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


test('opposed clearance requires separated inward caps, not merely different surface normals', () => {
  const a = { pivot: new THREE.Vector3(0, .15, 0), normal: new THREE.Vector3(0, 1, 0), radius: .31, inward: .07 }
  const b = { ...a, pivot: new THREE.Vector3(0, -.15, 0), normal: new THREE.Vector3(0, -1, 0) }
  expect(weaponEnvelopesSeparate(a, b)).toBe(true)
  expect(weaponEnvelopesSeparate(a, { ...b, pivot: new THREE.Vector3(0, .03, 0) })).toBe(false)
  expect(weaponEnvelopesSeparate(a, { ...b, normal: new THREE.Vector3(0, 0, 1) })).toBe(false)
  expect(weaponEnvelopesSeparate(a, { ...b, pivot: new THREE.Vector3(0, .4, 0) })).toBe(false)
})

test('opposed low-profile batteries keep real base and barrel vertices on separated sides under independent aim', () => {
  const group = createShip(resolveAppearance('Battlecruiser', 'crimson', 4, 'Combat', 4), 90210, 'hero', heavyFit)
  const actual = weapons(group), rig = group.userData.weaponRig as WeaponRig
  let checkedPairs = 0
  try {
    for (let a = 0; a < actual.length; a++) for (let b = a + 1; b < actual.length; b++) {
      if (actual[a].normal.dot(actual[b].normal) > -1 + 1e-8 || actual[a].pivot.distanceTo(actual[b].pivot) >= actual[a].radius + actual[b].radius) continue
      checkedPairs++
      const normal = actual[a].normal
      const plane = (actual[a].pivot.dot(normal) - actual[a].inward + actual[b].pivot.dot(normal) + actual[b].inward) / 2
      for (let pose = 0; pose < 25; pose++) for (const index of [a, b]) {
        const yaw = THREE.MathUtils.degToRad((index === a ? 1 : -1) * (-160 + pose * 37))
        const pitch = THREE.MathUtils.degToRad([-5, 0, 35, 70, 90][(pose + index) % 5])
        const mount = rig.mounts[index], outward = actual[index].normal
        const direction = new THREE.Vector3(1, 0, 0).applyAxisAngle(outward, yaw).multiplyScalar(Math.cos(pitch)).addScaledVector(outward, Math.sin(pitch))
        aimWeaponMount(rig, index, mount.pivot.clone().addScaledVector(direction, 10))
        const positions = actual[index].mesh.geometry.getAttribute('position')
        let minimumGap = Infinity
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).sub(mount.pivot)
          point.applyQuaternion(actual[index].elevation[vertex] > .5 ? mount.rotation : mount.traverseRotation!).add(mount.pivot)
          minimumGap = Math.min(minimumGap, (point.dot(normal) - plane) * (index === a ? 1 : -1))
        }
        expect(minimumGap).toBeGreaterThan(.0001)
      }
    }
    expect(checkedPairs).toBeGreaterThan(0)
  } finally {
    actual.forEach(({ mesh }) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
    dispose(group)
  }
})
