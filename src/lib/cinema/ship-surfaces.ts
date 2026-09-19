import * as THREE from 'three'

export interface ShipSurfaceOptions {
  kind: 'hull' | 'armor' | 'dark' | 'metal' | 'accent'
  empire?: string
  pirate?: boolean
  worldSize?: number
  density?: number
  seed?: number
}

const SIZE = 256
const byte = (value: number) => Math.round(Math.max(0, Math.min(255, value)))

/** Linear packed data: tone, relief, roughness, exposed substrate. No image,
 * canvas, color conversion, or browser API is needed to construct this atlas. */
export function createShipSurfaceAtlas(seed = 0, pirate = false): THREE.DataTexture {
  let state = (seed >>> 0) ^ 0x5f3759df
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ state >>> 15, 1 | state)
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
  const data = new Uint8Array(SIZE * SIZE * 4)
  const pixel = (x: number, y: number, tone: number, height: number, roughness: number, exposed = 0) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    const index = (y * SIZE + x) * 4
    data[index] = byte(tone); data[index + 1] = byte(height); data[index + 2] = byte(roughness); data[index + 3] = byte(exposed)
  }
  const panels: number[][] = []
  const divide = (x: number, y: number, width: number, height: number, depth: number, edges = [0, 0, 0, 0]) => {
    const vertical = width / height > 1.35 ? true : height / width > 1.35 ? false : random() > .5
    const length = vertical ? width : height
    if (depth >= 6 || length < 39 || (depth >= 3 && random() < .22)) { panels.push([x, y, width, height, ...edges]); return }
    const cut = Math.round(length * (.31 + random() * .38))
    if (vertical) {
      divide(x, y, cut, height, depth + 1, [edges[0], depth + 1, edges[2], edges[3]])
      divide(x + cut, y, width - cut, height, depth + 1, [depth + 1, edges[1], edges[2], edges[3]])
    } else {
      divide(x, y, width, cut, depth + 1, [edges[0], edges[1], edges[2], depth + 1])
      divide(x, y + cut, width, height - cut, depth + 1, [edges[0], edges[1], depth + 1, edges[3]])
    }
  }
  divide(0, 0, SIZE, SIZE, 0)
  for (const [x, y, width, height, ...edges] of panels) {
    const tone = 215 + random() * 34, roughness = 77 + random() * 100, relief = 183 + random() * 12
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
      const distances = [px - x, x + width - 1 - px, py - y, y + height - 1 - py]
      const edge = Math.min(...distances)
      const depth = Math.min(...edges.filter((_value, index) => distances[index] === edge))
      // Preserve large construction cuts across child panels. Later service
      // subdivisions are lighter and shallower, not an equally weighted grid.
      const strength = depth <= 2 ? 1 : depth === 3 ? .55 : .25
      const grain = (random() - .5) * 5, dirt = (pirate ? 11 : 4) * Math.exp(-edge / 2.5) * strength
      const seam = edge === 0, shoulder = edge === 1
      pixel(px, py, seam ? tone - (tone - 148) * strength + grain : tone - dirt - (shoulder ? 7 * strength : 0) + grain * .3,
        seam ? relief - (relief - 68) * strength : shoulder ? relief - (relief - 151) * strength : relief,
        roughness + grain + (seam ? 47 * strength : dirt), 0)
    }
    if (width > 27 && height > 24 && random() > .48) {
      const hx = x + Math.round(width * (.18 + random() * .10)), hy = y + Math.round(height * (.19 + random() * .12))
      const hw = Math.round(width * (.38 + random() * .21)), hh = Math.round(height * (.31 + random() * .19))
      for (let py = hy; py < hy + hh; py++) for (let px = hx; px < hx + hw; px++) {
        const edge = Math.min(px - hx, hx + hw - 1 - px, py - hy, hy + hh - 1 - py)
        pixel(px, py, tone - (edge === 0 ? 58 : 5), edge === 0 ? 92 : relief - 17, roughness + (edge === 0 ? 28 : 10))
      }
      // One inset latch, not a repeating decorative stripe on every plate.
      for (let py = hy + Math.floor(hh / 2) - 1; py <= hy + Math.floor(hh / 2); py++) pixel(hx + hw - 4, py, 166, 113, 156)
    }
    if (width > 22 && height > 22 && random() > .25) {
      for (const [bx, by] of [[x + 4, y + 4], [x + width - 5, y + height - 5]]) {
        pixel(bx, by, 148, 105, 133, 70)
        pixel(bx + 1, by, 206, 167, 104, 40)
      }
    }
    // Sparse edge chips and short hairline scuffs; large painted areas stay clean.
    const chips = random() < (pirate ? .8 : .30) ? 1 + Math.floor(random() * (pirate ? 5 : 2)) : 0
    for (let n = 0; n < chips; n++) {
      const px = x + 2 + Math.floor(random() * Math.max(1, width - 4)), py = y + (random() < .5 ? 2 : height - 3)
      for (let j = 0; j < 1 + random() * 3; j++) pixel(px + j, py, 211 + random() * 17, 145, 91 + random() * 22, 190)
    }
    if (random() < (pirate ? .35 : .10)) {
      const px = x + Math.floor(width * .3), py = y + Math.floor(height * (.3 + random() * .4))
      for (let j = 0; j < Math.min(width * .28, 8); j++) pixel(px + j, py + Math.floor(j / 4), tone - 13, relief - 12, roughness + 18, 30)
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType)
  texture.name = `cinema-manufactured-${seed >>> 0}-${pirate ? 'salvage' : 'paint'}`
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true
  return texture
}

// At most eight 256px atlases (four layouts, clean/salvaged), shared by all
// simultaneously alive ships. Last material disposal releases CPU/GPU ownership.
const atlases = new Map<number, { texture: THREE.DataTexture; owners: number }>()
const applied = new WeakSet<THREE.MeshStandardMaterial>()
const fragmentDeclarations = `
varying vec3 vCinemaSurfacePosition;
varying vec3 vCinemaSurfaceNormal;
uniform sampler2D cinemaSurfaceAtlas;
uniform float cinemaSurfaceDensity;
uniform float cinemaMicroScale;
uniform float cinemaMicroStrength;
uniform vec2 cinemaSurfaceOffset;
uniform float cinemaSurfaceRelief;
vec4 cinemaReadSurface(vec3 p, vec3 weights, vec3 dx, vec3 dy) {
  p *= cinemaSurfaceDensity; dx *= cinemaSurfaceDensity; dy *= cinemaSurfaceDensity;
  return textureGrad(cinemaSurfaceAtlas, p.zy + cinemaSurfaceOffset, dx.zy, dy.zy) * weights.x
    + textureGrad(cinemaSurfaceAtlas, p.xz + cinemaSurfaceOffset, dx.xz, dy.xz) * weights.y
    + textureGrad(cinemaSurfaceAtlas, p.xy + cinemaSurfaceOffset, dx.xy, dy.xy) * weights.z;
}
`

/** Apply once to a fresh material before gun articulation. Meshes may share this
 * material; its normal dispose event owns the atlas reference. A material.clone()
 * needs its own applyShipSurface call (Three does not clone shader callbacks). */
export function applyShipSurface<T extends THREE.MeshStandardMaterial>(material: T, options: ShipSurfaceOptions): T {
  if (applied.has(material)) return material
  applied.add(material)
  const seed = (options.seed ?? 0) >>> 0, key = (seed & 3) + (options.pirate ? 4 : 0)
  let entry = atlases.get(key)
  if (!entry) { entry = { texture: createShipSurfaceAtlas(seed & 3, options.pirate), owners: 0 }; atlases.set(key, entry) }
  entry.owners++
  const owned = entry
  const release = () => {
    material.removeEventListener('dispose', release)
    if (--owned.owners === 0) { atlases.delete(key); owned.texture.dispose() }
  }
  material.addEventListener('dispose', release)
  const gold = options.empire === 'nebula' && (options.kind === 'hull' || options.kind === 'armor')
  const base = gold ? options.kind === 'armor' ? [.38, .72] : [.42, .66]
    : { hull: [.46, .12], armor: [.41, .16], dark: [.65, .28], metal: [.36, .87], accent: [.44, .10] }[options.kind]
  const crimsonPaint = options.empire === 'crimson' && (options.kind === 'hull' || options.kind === 'armor')
  const empireRoughness = crimsonPaint ? .14 : options.empire === 'outerrim' ? .13 : options.empire === 'crimson' ? .025 : options.empire === 'nebula' && !gold ? -.035 : 0
  material.roughness = THREE.MathUtils.clamp(base[0] + empireRoughness + (options.pirate ? .09 : 0), .2, .85)
  material.metalness = base[1]
  const density = THREE.MathUtils.clamp(Number.isFinite(options.density) ? options.density! : 1, .25, 4)
  const worldSize = THREE.MathUtils.clamp(Number.isFinite(options.worldSize) ? options.worldSize! : 32, 16, 400)
  const previousCompile = material.onBeforeCompile, previousKey = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${previousKey}|cinema-surface-atlas-v1`
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    shader.uniforms.cinemaSurfaceAtlas = { value: owned.texture }
    shader.uniforms.cinemaSurfaceDensity = { value: density }
    shader.uniforms.cinemaMicroScale = { value: worldSize / (32 * density) }
    shader.uniforms.cinemaMicroStrength = { value: THREE.MathUtils.smoothstep(worldSize, 28, 70) }
    shader.uniforms.cinemaSurfaceOffset = { value: new THREE.Vector2((seed % 251) / 251, ((seed >>> 8) % 241) / 241) }
    shader.uniforms.cinemaSurfaceRelief = { value: (options.kind === 'dark' ? .0007 : .0017) / density }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCinemaSurfacePosition;\nvarying vec3 vCinemaSurfaceNormal;')
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vCinemaSurfacePosition = position;
vCinemaSurfaceNormal = normal;`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fragmentDeclarations}`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
vec3 cinemaWeights = pow(abs(vCinemaSurfaceNormal), vec3(8.0));
cinemaWeights.y += 1e-8;
cinemaWeights /= dot(cinemaWeights, vec3(1.0));
vec3 cinemaLocalDx = dFdx(vCinemaSurfacePosition), cinemaLocalDy = dFdy(vCinemaSurfacePosition);
vec4 cinemaPacked = cinemaReadSurface(vCinemaSurfacePosition, cinemaWeights, cinemaLocalDx, cinemaLocalDy);
vec4 cinemaMicro = cinemaReadSurface(vCinemaSurfacePosition * cinemaMicroScale + vec3(0.173), cinemaWeights, cinemaLocalDx * cinemaMicroScale, cinemaLocalDy * cinemaMicroScale);
diffuseColor.rgb *= mix(0.16, 1.08, cinemaPacked.r);
diffuseColor.rgb *= mix(1.0, mix(0.87, 1.04, cinemaMicro.r), cinemaMicroStrength);
// Exposed chips reveal neutral substrate without recoloring broad painted areas.
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22), cinemaPacked.a * 0.32);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (cinemaPacked.b - 0.50) * 0.45, 0.20, 0.91);
roughnessFactor = mix(roughnessFactor, 0.34, cinemaPacked.a * 0.65);
roughnessFactor = clamp(roughnessFactor + (cinemaMicro.b - 0.5) * 0.12 * cinemaMicroStrength, 0.2, 0.94);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.88, cinemaPacked.a);`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Explicit texture gradients retain the same mip footprint for all three
// height samples. No derivative is taken of a derivative or filtered gradient.
vec2 cinemaHeightDelta = vec2(
  cinemaReadSurface(vCinemaSurfacePosition + cinemaLocalDx, cinemaWeights, cinemaLocalDx, cinemaLocalDy).g - cinemaPacked.g,
  cinemaReadSurface(vCinemaSurfacePosition + cinemaLocalDy, cinemaWeights, cinemaLocalDx, cinemaLocalDy).g - cinemaPacked.g) * cinemaSurfaceRelief;
vec3 cinemaViewDx = dFdx(-vViewPosition), cinemaViewDy = dFdy(-vViewPosition);
vec3 cinemaR1 = cross(cinemaViewDy, normal), cinemaR2 = cross(normal, cinemaViewDx);
float cinemaDet = dot(cinemaViewDx, cinemaR1) * faceDirection;
// Convert object-space relief to view-space length so a scaled ship has the
// same bevel slopes. Actor transforms use uniform scale; guards cover edge-ons.
vec2 cinemaScale = vec2(length(cinemaViewDx) / max(length(cinemaLocalDx), 1e-8), length(cinemaViewDy) / max(length(cinemaLocalDy), 1e-8));
cinemaHeightDelta *= cinemaScale;
vec3 cinemaGradient = sign(cinemaDet) * (cinemaHeightDelta.x * cinemaR1 + cinemaHeightDelta.y * cinemaR2);
cinemaGradient *= min(1.0, abs(cinemaDet) * 0.65 / max(length(cinemaGradient), 1e-12));
vec3 cinemaBumped = abs(cinemaDet) * normal - cinemaGradient;
if (abs(cinemaDet) > 1e-10) normal = normalize(cinemaBumped);`)
  }
  material.needsUpdate = true
  return material
}
