import * as THREE from 'three'
import type { ShipRecipe } from './appearance'

export type SpecialHullMaterial = 'hull' | 'armor' | 'dark' | 'metal' | 'accent' | 'glass' | 'windows'
export interface SpecialHullContext {
  add(geometry: THREE.BufferGeometry, material: SpecialHullMaterial, x?: number, y?: number, z?: number, rotation?: THREE.Euler): void
  slab(x: number, y: number, z: number, length: number, width: number, height: number, material?: SpecialHullMaterial): void
  rounded(x: number, y: number, z: number, length: number, width: number, height: number, material?: SpecialHullMaterial): void
  rod(x: number, y: number, z: number, radius: number, length: number, material?: SpecialHullMaterial, alongX?: boolean): void
  engine(x: number, y: number, z: number, radius: number): void
  hero: boolean
  h: number
  w: number
}

type Ring = readonly [x: number, width: number, height: number, y?: number]
type Point = readonly [number, number, number]

/** Named exceptions follow the catalog and supplied chromakeys. +X is the bow.
 * All static geometry goes through the caller's seven material batches; detail
 * levels change tessellation, never the defining silhouette or add fitted guns. */
export function buildSpecialHull(recipe: ShipRecipe | undefined, c: SpecialHullContext): boolean {
  if (!recipe) return false
  const { add, slab, rounded, rod, engine, hero, h, w } = c
  const segments = hero ? 24 : 12
  const shell = (rings: readonly Ring[], material: SpecialHullMaterial, z = 0) => {
    const positions: number[] = [], indices: number[] = []
    for (const [x, width, height, y = 0] of rings) {
      for (let j = 0; j < segments; j++) {
        const a = j / segments * Math.PI * 2
        positions.push(x, y + Math.sin(a) * height, Math.cos(a) * width)
      }
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < segments; j++) {
      const a = i * segments + j, b = i * segments + (j + 1) % segments
      indices.push(a, a + segments, b, b, a + segments, b + segments)
    }
    // Separate cap vertices keep rounded sides smooth and end plates flat.
    for (const end of [0, rings.length - 1]) {
      const ring = rings[end], base = positions.length / 3
      positions.push(ring[0], ring[3] ?? 0, 0)
      for (let j = 0; j < segments; j++) {
        const a = j / segments * Math.PI * 2
        positions.push(ring[0], (ring[3] ?? 0) + Math.sin(a) * ring[2], Math.cos(a) * ring[1])
      }
      for (let j = 0; j < segments; j++) {
        const a = base + 1 + j, b = base + 1 + (j + 1) % segments
        if (end === 0) indices.push(base, a, b)
        else indices.push(base, b, a)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    add(geometry, material, 0, 0, z)
  }
  const bar = (from: Point, to: Point, radius = .004, material: SpecialHullMaterial = 'metal') => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a)
    const geometry = new THREE.CylinderGeometry(radius, radius, d.length(), hero ? 8 : 5)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
    const middle = a.add(b).multiplyScalar(.5)
    add(geometry, material, middle.x, middle.y, middle.z)
  }
  const curve = (points: Point[], radius: number, material: SpecialHullMaterial = 'metal') => {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), hero ? 28 : 12, radius, hero ? 7 : 4, false), material)
  }
  const orb = (x: number, y: number, z: number, radius: number, material: SpecialHullMaterial, sx = 1, sy = 1, sz = 1) => {
    const geometry = new THREE.SphereGeometry(radius, hero ? 16 : 8, hero ? 10 : 6)
    geometry.scale(sx, sy, sz)
    add(geometry, material, x, y, z)
  }
  const container = (x: number, y: number, z: number, length: number, width: number, height: number, variant: number) => {
    slab(x, y, z, length, width, height, variant % 2 ? 'armor' : 'hull')
    const count = hero ? 11 : 5
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) slab(x - length * .43 + length * .86 * i / (count - 1), y, z + side * width * .502, length * .015, .004, height * .83, 'armor')
      for (const up of [-1, 1]) bar([x - length / 2, y + up * height / 2, z + side * width / 2], [x + length / 2, y + up * height / 2, z + side * width / 2], .0045)
      for (const fore of [-1, 1]) bar([x + fore * length / 2, y - height / 2, z + side * width / 2], [x + fore * length / 2, y + height / 2, z + side * width / 2], .0045)
    }
    if (hero) {
      slab(x + length * .16, y + height * .51, z - width * .1, length * .2, width * .35, .003, 'metal')
      for (const side of [-1, 1]) bar([x + length * .503, y - height * .39, z + side * width * .2], [x + length * .503, y + height * .39, z + side * width * .2], .0025, 'dark')
    }
  }
  const openPilot = (x: number, y: number, z: number, scale: number) => {
    const p = (dx: number, dy: number, dz: number): Point => [x + dx * scale, y + dy * scale, z + dz * scale]
    slab(x, y, z, .09 * scale, .073 * scale, .018 * scale, 'metal')
    slab(x - .03 * scale, y + .035 * scale, z, .015 * scale, .06 * scale, .075 * scale, 'dark')
    for (const side of [-1, 1]) {
      bar(p(-.06, -.035, side * .046), p(.07, -.035, side * .046), .003 * scale)
      bar(p(-.06, -.035, side * .046), p(-.06, .1, side * .046), .003 * scale)
      bar(p(-.06, .1, side * .046), p(.085, .1, side * .046), .003 * scale)
      bar(p(.085, .1, side * .046), p(.085, -.035, side * .046), .003 * scale)
    }
    // The pilot is exposed to space; even the distant silhouette has no canopy.
    orb(x, y + .039 * scale, z, .026 * scale, 'armor', .7, 1.3, .85)
    orb(x + .008 * scale, y + .078 * scale, z, .022 * scale, 'metal')
    orb(x + .023 * scale, y + .08 * scale, z, .015 * scale, 'glass', .5, .75, 1)
    if (hero) for (const side of [-1, 1]) {
      bar(p(.004, .047, side * .023), p(.046, .025, side * .025), .008 * scale, 'armor')
      bar(p(.012, .003, side * .015), p(.055, -.025, side * .021), .009 * scale, 'armor')
    }
  }
  const machinery = (x: number, y: number, z: number, radius: number, length: number, nozzle: number) => {
    rod(x, y, z, radius, length, 'dark')
    for (const offset of [-.32, 0, .32]) rod(x + offset * length, y, z, radius * 1.07, length * .09, 'metal')
    for (let i = 0; i < (hero ? 8 : 4); i++) {
      const a = i * Math.PI * 2 / (hero ? 8 : 4)
      bar([x - length * .42, y + Math.sin(a) * radius, z + Math.cos(a) * radius], [x + length * .4, y + Math.sin(a) * radius, z + Math.cos(a) * radius], radius * .055, i % 2 ? 'armor' : 'metal')
    }
    for (const side of [-1, 1]) engine(x - length * .5, y, z + side * radius * .43, nozzle)
  }

  if (recipe === 'prayer') {
    container(.035, -h * .4, 0, .6, w * 1.4, h * .78, 0)
    container(.035, h * .42, 0, .6, w * 1.4, h * .78, 1)
    machinery(-.36, 0, 0, Math.min(w * .77, h * .92), .22, .035)
    openPilot(.4, -h * .2, 0, .85)
    for (const side of [-1, 1]) bar([-.26, -h * .76, side * w * .6], [.44, -h * .76, side * w * .6], .007)
    return true
  }
  if (recipe === 'worship') {
    // Four Prayer assemblies bound into one squat bundle, with one crew seat.
    for (const side of [-1, 1]) for (const up of [-1, 1]) {
      for (const stack of [-1, 1]) container(.045, up * h * .48 + stack * h * .22, side * w * .49, .64, w * .9, h * .41, up + side + stack)
      machinery(-.365, up * h * .46, side * w * .49, h * .42, .22, .017)
    }
    for (const x of [-.17, .18]) {
      slab(x, h * .94, 0, .035, w * 1.98, .007, 'dark')
      slab(x, -h * .94, 0, .035, w * 1.98, .007, 'dark')
      for (const side of [-1, 1]) slab(x, 0, side * w * .98, .035, .007, h * 1.89, 'dark')
    }
    openPilot(.415, -h * .2, 0, .62)
    return true
  }
  if (recipe === 'congregation') {
    // The catalog explicitly describes a train of containers and a rooftop seat.
    for (let i = 0; i < 4; i++) for (const up of [-1, 1]) container(-.275 + i * .205, up * h * .39, 0, .19, w * 1.85, h * .7, i + up)
    for (const side of [-1, 1]) {
      bar([-.46, -h * .86, side * w * .86], [.46, -h * .86, side * w * .86], .008)
      machinery(-.415, -h * .05, side * w * .52, h * .43, .13, .018)
    }
    openPilot(.25, h * .83, 0, .36)
    return true
  }

  const nacelle = (z: number, x: number, length: number, width: number, height: number, material: SpecialHullMaterial = 'hull') => {
    shell([[x - length / 2, width * .7, height * .7], [x - length * .28, width, height], [x + length * .23, width * .8, height * .85], [x + length / 2, width * .05, height * .08]], material, z)
    engine(x - length / 2, 0, z, Math.min(width * .56, .027))
  }
  const pinstripe = (points: Point[], radius = .003) => curve(points, radius, 'metal')
  if (recipe === 'concordia' || recipe === 'comet') {
    const comet = recipe === 'comet'
    const beam = w * (comet ? .52 : .56), height = h * .57
    shell([[-.46, beam * .38, height * .6], [-.32, beam, height], [-.06, beam * .87, height], [.2, beam * .43, height * .58], [.48, .002, .002]], 'hull')
    for (const side of [-1, 1]) {
      // Swept shoulders support engines, leaving a clean needle bow.
      curve([[-.34, -.008, side * beam * .65], [-.24, 0, side * w * .56], [-.12, 0, side * w * .76]], .012, 'armor')
      nacelle(side * w * .78, comet ? -.22 : -.29, comet ? .44 : .3, w * .19, h * .44)
      pinstripe([[-.4, height * .59, side * beam * .58], [-.16, height * .85, side * beam * .48], [.13, height * .54, side * beam * .26], [.39, .009, side * .006]])
      // Glazing follows the changing cross-section rather than floating beside it.
      for (let i = 0; i < (hero ? 16 : 7); i++) {
        const t = i / ((hero ? 16 : 7) - 1), x = -.32 + t * .44
        const width = beam * (x < -.06 ? 1 - (x + .32) / .26 * .13 : .87 - (x + .06) / .26 * .44)
        const hy = height * (x < -.06 ? 1 : 1 - (x + .06) / .26 * .42)
        for (const row of comet ? [0] : [-1, 1]) rounded(x, row * hy * .26, side * width * .975, hero ? .013 : .033, .003, comet ? .009 : .0045, 'windows')
      }
      if (comet) {
        curve([[.15, -.006, side * beam * .46], [.08, -.004, side * w * .42], [.05, -.004, side * w * .48]], .005, 'metal')
        slab(-.38, h * .6, side * beam * .24, .13, .01, h * .37, 'armor')
      }
    }
    shell([[-.27, beam * .34, h * .05, height * .85], [-.2, beam * .42, h * .26, height * .85], [-.08, beam * .21, h * .1, height * .85], [.01, .002, .002, height * .71]], 'glass')
    if (comet) shell([[.16, beam * .2, h * .07, height * .54], [.25, beam * .12, h * .06, height * .35], [.31, .001, .001, height * .22]], 'glass')
    engine(-.46, -.006, 0, .018)
    return true
  }

  if (recipe === 'liquidity_event' || recipe === 'midas') {
    const midas = recipe === 'midas', outer: SpecialHullMaterial = midas ? 'metal' : 'hull'
    shell([[-.47, w * .5, h * .3, -h * .28], [-.32, w * .9, h * .55, -h * .28], [.06, w, h * .53, -h * .28], [.3, w * .6, h * .36, -h * .17], [.49, .003, .008, -h * .04]], outer)
    // Recurring glass and overhanging rims read as occupied terraces, not armor.
    for (let deck = 0; deck < 3; deck++) {
      const aft = -.39 + deck * .035, fore = .29 - deck * .14
      const y = h * (.1 + deck * .34), dw = w * (.82 - deck * .17)
      shell([[aft, dw * .64, h * .08, y], [aft + .1, dw, h * .1, y], [fore - .08, dw * .7, h * .1, y], [fore, dw * .2, h * .045, y]], 'glass')
      shell([[aft - .015, dw * .67, .004, y + h * .12], [aft + .1, dw * 1.06, .006, y + h * .12], [fore - .07, dw * .77, .006, y + h * .12], [fore + .025, dw * .16, .003, y + h * .1]], 'metal')
      for (const side of [-1, 1]) {
        pinstripe([[aft, y + h * .22, side * dw * .7], [aft + .12, y + h * .23, side * dw * 1.01], [fore - .08, y + h * .23, side * dw * .74], [fore + .01, y + h * .17, side * dw * .18]], .002)
        if (hero) for (let i = 0; i < 6; i++) {
          const t = i / 5, x = aft + .12 + t * (fore - aft - .21), z = side * dw * (1 - t * .26)
          bar([x, y + h * .13, z], [x, y + h * .23, z], .0013)
          rounded(x, y, side * dw * (1 - t * .3), .023, .002, .004, 'windows')
        }
      }
    }
    for (const side of [-1, 1]) {
      engine(-.46, -h * .27, side * w * .35, .025)
      pinstripe([[-.4, -h * .24, side * w * .73], [-.1, -h * .16, side * w * .99], [.22, -h * .09, side * w * .75], [.46, -h * .02, side * .018]], .004)
      // Sweeping open architectural ribs are the yacht's signature silhouette.
      curve([[-.36, h * .35, side * w * .71], [-.3, h * 1.08, side * w * .63], [-.12, h * 1.2, side * w * .45], [.12, h * .32, side * w * .66]], midas ? .006 : .01, 'metal')
    }
    if (midas) {
      const dome = new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2)
      dome.scale(.14, h * .83, w * .61)
      const facets = dome.toNonIndexed()
      facets.computeVertexNormals()
      add(facets, 'glass', .12, h * .23)
      dome.dispose()
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI / 5, z = Math.cos(a) * w * .6
        curve([[-.01, h * .23, z], [.05, h * .83, z * .67], [.13, h * 1.04, z * .3], [.22, h * .62, z * .6], [.25, h * .23, z]], .0024)
      }
      for (const side of [-1, 1]) orb(-.27, h * .91, side * w * .29, .012, 'accent', 1, .5, 1)
    } else {
      rod(-.26, h * 1.15, 0, .0028, h * .52, 'metal', false)
      for (const side of [-1, 1]) orb(-.27, h * .98, side * w * .22, .015, 'armor')
      // Ballroom windows form large teardrops under the arches.
      for (const side of [-1, 1]) orb(-.05, h * .19, side * w * .69, 1, 'glass', .18, h * .3, .012)
    }
    return true
  }
  return false
}
