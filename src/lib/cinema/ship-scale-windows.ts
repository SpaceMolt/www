import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CREW_SCALE } from './ship-scale'

/** Convert legacy luminous apertures into small panes inside the same authored
 * opening. Beacons and already calibrated detail geometry remain untouched. */
export function calibrateCrewWindows(geometry: THREE.BufferGeometry, worldSize: number): THREE.BufferGeometry {
  if ((geometry.userData.cinemaCrewScale || geometry.userData.scaleWindow) || !Number.isFinite(worldSize) || worldSize < 32) return geometry
  geometry.computeBoundingBox()
  const box=geometry.boundingBox!, size=box.getSize(new THREE.Vector3()).toArray(), center=box.getCenter(new THREE.Vector3()).toArray()
  const axes=[0,1,2].sort((a,b)=>size[a]-size[b]), [normal,vertical,horizontal]=axes
  if (size[normal] > size[vertical]*.65 || size[vertical]<1e-7) return geometry
  const width=Math.min(size[horizontal]*worldSize,CREW_SCALE.windowWidth), height=Math.min(size[vertical]*worldSize,CREW_SCALE.windowHeight)
  if(size[horizontal]*worldSize<=width && size[vertical]*worldSize<=height) return geometry
  const columns=Math.max(1,Math.floor((size[horizontal]*worldSize-width)/CREW_SCALE.windowPitch)+1)
  const rows=Math.max(1,Math.floor((size[vertical]*worldSize-height)/CREW_SCALE.deckPitch)+1)
  const stride=Math.max(1,Math.ceil(columns*rows/64)), panes:THREE.BufferGeometry[]=[]
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++) {
    if((row*columns+column)%stride)continue
    const dimensions=[0,0,0], point=[...center]
    dimensions[normal]=Math.min(size[normal],.06/worldSize)
    dimensions[horizontal]=width/worldSize;dimensions[vertical]=height/worldSize
    point[horizontal]+=(column-(columns-1)*.5)*CREW_SCALE.windowPitch/worldSize
    point[vertical]+=(row-(rows-1)*.5)*CREW_SCALE.deckPitch/worldSize
    const indexed=new THREE.BoxGeometry(...dimensions as [number,number,number])
    const pane=indexed.toNonIndexed();indexed.dispose()
    pane.translate(...point as [number,number,number]);panes.push(pane)
  }
  const result=mergeGeometries(panes,false)
  for(const pane of panes)pane.dispose()
  if(!result)return geometry
  geometry.dispose();result.userData.cinemaCrewScale=true
  return result
}
