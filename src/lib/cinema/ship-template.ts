import * as THREE from 'three'

/** Flatten one material batch for the shared distant-fleet mesh. The returned
 * geometry is owned by the caller; the source geometry/material stay intact. */
export function bakeShipTemplateGeometry(source: THREE.BufferGeometry, material: Pick<THREE.MeshStandardMaterial, 'color' | 'vertexColors'>, matrixWorld: THREE.Matrix4): THREE.BufferGeometry {
  let geometry = source.clone()
  if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat }
  const components = material.vertexColors ? geometry.getAttribute('color') : undefined
  for (const key of Object.keys(geometry.attributes)) if (key !== 'position' && key !== 'normal') geometry.deleteAttribute(key)
  const colors = new Float32Array(geometry.getAttribute('position').count * 3)
  for (let vertex = 0; vertex < colors.length / 3; vertex++) {
    // Attribute accessors decode normalized byte colors as linear 0..1 values.
    // This matches Three's diffuse material tint multiplied by vertex paint.
    colors[vertex * 3] = material.color.r * (components?.getX(vertex) ?? 1)
    colors[vertex * 3 + 1] = material.color.g * (components?.getY(vertex) ?? 1)
    colors[vertex * 3 + 2] = material.color.b * (components?.getZ(vertex) ?? 1)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.applyMatrix4(matrixWorld)
  return geometry
}
