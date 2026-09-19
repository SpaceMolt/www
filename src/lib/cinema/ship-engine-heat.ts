import * as THREE from 'three'

/** Local heat staining around at most four real engine collars, shared by a ship. */
export function applyEngineHeat(materials: THREE.MeshStandardMaterial[], engines: readonly THREE.Vector4[]) {
  const centers = [...engines].sort((a, b) => b.w - a.w).slice(0, 4).map(center => center.clone())
  const count = { value: centers.length }
  while (centers.length < 4) centers.push(new THREE.Vector4(0, 0, 0, 1))
  const field = { value: centers }
  for (const material of materials) {
    const previous = material.onBeforeCompile.bind(material)
    const previousKey = material.customProgramCacheKey.bind(material)
    material.customProgramCacheKey = () => `${previousKey()}-cinema-engine-heat-v1`
    material.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer)
      shader.uniforms.cinemaHeatCenters = field
      shader.uniforms.cinemaHeatCount = count
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCinemaHeatPosition;')
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCinemaHeatPosition = position;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCinemaHeatPosition;
uniform vec4 cinemaHeatCenters[4];
uniform int cinemaHeatCount;`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float cinemaHeat = 0.0;
for (int engineIndex = 0; engineIndex < 4; engineIndex++) {
  if (engineIndex >= cinemaHeatCount) break;
  vec3 collarOffset = (vCinemaHeatPosition - cinemaHeatCenters[engineIndex].xyz) / cinemaHeatCenters[engineIndex].w;
  float collarRadius = length(collarOffset.yz);
  float radialHeat = smoothstep(0.65, 1.1, collarRadius) * (1.0 - smoothstep(1.5, 2.6, collarRadius));
  float axialHeat = 1.0 - smoothstep(0.6, 2.0, abs(collarOffset.x + 0.15));
  cinemaHeat = max(cinemaHeat, radialHeat * axialHeat);
}
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.70, 0.65, 0.59), cinemaHeat * 0.65);`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.90, cinemaHeat * 0.35);`)
    }
  }
}
