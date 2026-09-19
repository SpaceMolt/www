import * as THREE from 'three'

const donorPaint = [0x9c9d91, 0x79775c, 0x8a6250, 0x526b68, 0xa38c60, 0x545a61].map(color => new THREE.Color(color))

/** Component colors survive material batching; one color per manufactured part,
 * never per triangle, and no extra materials or textures for replacement paint. */
export function colorSalvagePart(geometry: THREE.BufferGeometry, original: THREE.Color, seed: number, replacement: boolean) {
  geometry.computeBoundingBox()
  const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3())
  let hash=(seed|0)^Math.imul(Math.round(center.x*100),73856093)^Math.imul(Math.round(center.y*100),19349663)^Math.imul(Math.round(Math.abs(center.z)*100),83492791)
  hash=Math.imul(hash^(hash>>>16),0x45d9f3b);hash=(hash^(hash>>>16))>>>0
  const color=original.clone()
  // Continuous main hulls and tiny hardware retain their donor finish. Broad
  // cargo skins, shoulders and replacement sheets can carry salvaged paint.
  if(replacement&&size.x<.88&&size.x*Math.max(size.y,size.z)>.0025&&hash%8>1) color.lerp(donorPaint[(hash%8)-2],.82)
  const positions=geometry.getAttribute('position'),colors=new Uint8Array(positions.count*3)
  const channels=[color.r,color.g,color.b].map(value=>Math.round(THREE.MathUtils.clamp(value,0,1)*255))
  for(let i=0;i<colors.length;i+=3)colors.set(channels,i)
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true))
}
