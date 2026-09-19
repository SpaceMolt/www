import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { resolveAppearance } from './appearance'
import { addRetrothrusters, updateRetrothrusters } from './ship-thrusters'

function hull() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, .2, .4), new THREE.MeshStandardMaterial())
  body.name = 'hull'
  group.add(body)
  return group
}

test('retro nozzles seat on forward hull faces and exhaust toward +X with two added draws', () => {
  const group = hull()
  const exhaust = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .6), new THREE.MeshBasicMaterial())
  exhaust.position.x = 1
  exhaust.userData.engine = true
  group.add(exhaust)
  addRetrothrusters(group, resolveAppearance('Cruiser', 'solarian'))
  const added = group.children.filter(o => o.userData.retrothruster)
  expect(added).toHaveLength(2)
  const casing = added.find(o => !o.userData.retrothrusterGlow) as THREE.Mesh
  const glow = added.find(o => o.userData.retrothrusterGlow) as THREE.Mesh
  const mounts = casing.userData.mounts as THREE.Vector3[]
  expect(mounts).toHaveLength(2)
  expect(mounts[0].z * mounts[1].z).toBeLessThan(0)
  for (const point of mounts) expect(point.x).toBeCloseTo(.5, 5)
  const casingBox = new THREE.Box3().setFromObject(casing)
  const glowBox = new THREE.Box3().setFromObject(glow)
  expect(casingBox.min.x).toBeLessThan(.5)
  expect(casingBox.max.x).toBeGreaterThan(.5)
  expect(glowBox.min.x).toBeGreaterThan(.5)
  expect(glowBox.max.x).toBeGreaterThan(casingBox.max.x)
  expect(glow.visible).toBe(false)
})

test('metal hulls and transformed child hulls are supported; distant or empty models add nothing', () => {
  const group = hull(), body = group.children[0]
  body.name = 'metal'; body.position.x = -.12
  group.position.set(20, 30, 40); group.rotation.y = .6; group.scale.setScalar(12)
  addRetrothrusters(group, resolveAppearance('Yacht', 'nebula'))
  const casing = group.children.find(o => o.userData.retrothruster && !o.userData.retrothrusterGlow)!
  for (const point of casing.userData.mounts as THREE.Vector3[]) expect(point.x).toBeCloseTo(.38, 5)
  const distant = hull()
  addRetrothrusters(distant, resolveAppearance('Cruiser'), 0, false)
  expect(distant.children).toHaveLength(1)
  const empty = new THREE.Group()
  addRetrothrusters(empty, resolveAppearance('Cruiser'))
  expect(empty.children).toHaveLength(0)
  for (const kind of ['Creature', 'Station']) {
    const stationary = hull()
    addRetrothrusters(stationary, resolveAppearance(kind))
    expect(stationary.children).toHaveLength(1)
  }
})

test('fitted mount triangles cannot become nozzle supports', () => {
  const group = hull()
  const mount = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .5), new THREE.MeshStandardMaterial())
  mount.name = 'armor'; mount.position.x = 1
  mount.geometry.setAttribute('cinemaMount', new THREE.Float32BufferAttribute(new Array(mount.geometry.getAttribute('position').count).fill(0), 1))
  group.add(mount)
  addRetrothrusters(group, resolveAppearance('Cruiser', 'solarian'))
  const casing = group.children.find(o => o.userData.retrothruster && !o.userData.retrothrusterGlow)!
  for (const point of casing.userData.mounts as THREE.Vector3[]) expect(point.x).toBeCloseTo(.5, 5)
})

test('braking intensity is finite and reversible without altering main-engine visibility', () => {
  const group = hull()
  addRetrothrusters(group, resolveAppearance('Cruiser'))
  const glow = group.children.find(o => o.userData.retrothrusterGlow) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  updateRetrothrusters(group, .6)
  expect(glow.visible).toBe(true)
  expect(glow.material.opacity).toBeGreaterThan(0)
  expect(glow.material.opacity).toBeLessThan(1)
  updateRetrothrusters(group, 4)
  expect(glow.material.opacity).toBeLessThanOrEqual(1)
  for (const value of [0, -1, NaN, Infinity]) {
    updateRetrothrusters(group, value)
    expect(glow.visible).toBe(false)
  }
})
