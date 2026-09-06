import * as THREE from 'three'
import type { CinemaHardware } from './hardware'
import type { ShipFamily, ShipAppearance } from './appearance'
import type { CinemaWeaponFamily } from './weapons'
import type { SpecialHullContext } from './ship-recipes'

export function cinemaGunSize(appearance: Pick<ShipAppearance, 'tier'|'hullEmpire'|'family'>): number {
  const small=appearance.family==='fighter'||appearance.family==='scout'
  const tier=Math.max(0,Math.min(5,Number.isFinite(appearance.tier)?appearance.tier:1))
  return Math.min(.145,(small?.050:.064)*(1.4+tier*.19)*(appearance.hullEmpire==='crimson'?1.18:1))
}

export interface WeaponEnvelope {
  pivot: THREE.Vector3
  normal: THREE.Vector3
  radius: number
  inward: number
}

/** Opposed batteries occupy separate outward half-spaces even where their
 * unrestricted spheres overlap. All other orientations use the full spheres. */
export function weaponEnvelopesSeparate(a: WeaponEnvelope, b: WeaponEnvelope, margin = .006): boolean {
  if (a.pivot.distanceTo(b.pivot) >= a.radius + b.radius + margin) return true
  if (a.normal.dot(b.normal) > -1 + 1e-8) return false
  return a.pivot.clone().sub(b.pivot).dot(a.normal) >= a.inward + b.inward + margin
}

/** Bounded representative external equipment; counts describe a fit, not literal sockets. */
export function buildFittedHardware(profile: CinemaHardware | undefined, family: ShipFamily, c: SpecialHullContext & { deckAt?: (x:number,z:number)=>number; appearance?: ShipAppearance; hullSurface?: (point:THREE.Vector3,outward:THREE.Vector3)=>THREE.Vector3|undefined; beginWeapon?: (family:CinemaWeaponFamily,pivot:THREE.Vector3,muzzle:THREE.Vector3,constructionRoll?:number,normal?:THREE.Vector3)=>void; elevateWeapon?: ()=>void; endWeapon?: ()=>void }) {
  const { add,slab,rounded,rod,h,w,hero }=c
  const known=profile && profile.source!=='unknown'
  const legacyCount=family==='fighter'?2:family==='warship'?3:family==='capital'?4:0
  const weapons=known?profile.weapons:({kinetic:legacyCount} as Partial<Record<CinemaWeaponFamily,number>>)
  // Distant hulls omit all fine equipment: their silhouettes remain a bounded set.
  if(!hero) return
  const entries=Object.entries(weapons).filter(([,count])=>count && count>0) as [CinemaWeaponFamily,number][]
  const s=c.appearance?cinemaGunSize(c.appearance):.10
  // Long barrels need real swept space, not merely a gap between their bases.
  // These conservative component bounds are checked against rendered triangles.
  const radiusOf=(kind:CinemaWeaponFamily)=>s*({railgun:2.13,autocannon:1.78,kinetic:1.75,flak:1.46,plasma:1.48,laser:1.27,beam:1.27,exotic:1.40,disruptor:1.40,torpedo:1.30,missile:1.04,mine:1.02,smartbomb:1.02}[kind])
  // Includes negative-X stocks at 90deg elevation, barrel thickness at 5deg
  // depression, and the traverse-only base's .24s inward depth.
  const inwardOf=(kind:CinemaWeaponFamily)=>s*({railgun:.48,autocannon:.26,kinetic:.26,flak:.26,plasma:.50,laser:.49,beam:.49,exotic:.50,disruptor:.50,torpedo:1.20,missile:.94,mine:.80,smartbomb:.80}[kind])
  const heightOf=(kind:CinemaWeaponFamily)=>kind==='missile'||kind==='torpedo'?.55:kind==='plasma'?.48:kind==='exotic'||kind==='disruptor'?.45:kind==='beam'||kind==='laser'?.42:kind==='mine'||kind==='smartbomb'?.62:.40
  const width=Math.min(.27,Math.max(w+.035,.22)),height=Math.min(.24,Math.max(h+.10,.20))
  const candidates:{point:THREE.Vector3;normal:THREE.Vector3;attachment:THREE.Vector3;sampled?:boolean;surface?:THREE.Vector3}[]=[]
  const candidate=(x:number,y:number,z:number)=>candidates.push({point:new THREE.Vector3(x,y,z),normal:new THREE.Vector3(0,y,z).normalize(),attachment:new THREE.Vector3(0,y,z).normalize()})
  if(c.appearance?.recipe==='shard') {
    candidate(.20,.285,0)
    candidate(-.20,.285,0)
  }
  // Prefer broadly usable dorsal positions for each represented mechanism.
  // Additional batteries use the actual outward normal of their hull surface.
  const reach=s>.12?.318:Math.max(w*.8,.17)
  const dorsalHeight=s>.12?Math.max(h+.16,.31):Math.max(height,.22)
  candidate(.32,dorsalHeight,0)
  candidate(-.32,dorsalHeight,reach)
  candidate(-.32,dorsalHeight,-reach)
  candidate(-.32,-.32,0)
  candidate(.32,-.32,0)
  // Alternating upper/lower sponsons spread large batteries around the hull.
  // The tetrahedral ordering fits four huge independent mounts before extras.
  for(const [x,y,z] of [[.32,height,width],[.32,-height,-width],[-.32,height,-width],[-.32,-height,width]]) candidate(x,y,z)
  for(const x of [.29,-.29,0,.13,-.13]) for(const [y,z] of [[height,0],[0,width],[-height,0],[0,-width],[height,width],[-height,-width],[height,-width],[-height,width]]) candidate(x,y,z)
  const placed:{kind:CinemaWeaponFamily;pivot:THREE.Vector3;normal:THREE.Vector3;surface:THREE.Vector3;attachment:THREE.Vector3;radius:number;inward:number}[]=[]
  const place=(kind:CinemaWeaponFamily,dorsalOnly=false)=>{
    const radius=radiusOf(kind)
    for(const candidate of candidates) {
      const {normal,attachment}=candidate,pivot=candidate.point.clone()
      // Fixed-base side gimbals can roll their barrel width inward. Reserve a
      // full sphere instead of applying the deck bearing's elevation-only cap.
      const inward=Math.abs(normal.y)<1e-8&&Math.abs(normal.z)>1-1e-8?radius:inwardOf(kind)
      if(dorsalOnly&&normal.y<.999) continue
      if(!candidate.sampled) {
        candidate.surface=c.hullSurface?.(pivot,attachment)??(normal.y>.999?new THREE.Vector3(pivot.x,c.deckAt?.(pivot.x,pivot.z)??h,pivot.z):undefined)
        candidate.sampled=true
      }
      const surface=candidate.surface
      if(!surface||!Number.isFinite(surface.lengthSq())) continue
      const clearance=s*.26+.012
      pivot.copy(surface).addScaledVector(normal,clearance)
      if(pivot.length()+radius>.775) continue
      if(placed.some(other=>!weaponEnvelopesSeparate({pivot,normal,radius,inward},other))) continue
      placed.push({kind,pivot,normal,surface,attachment,radius,inward})
      return true
    }
    return false
  }
  // Represent loadout mechanisms first, then fill only genuinely free space with
  // duplicates. Largest mechanisms reserve their positions before small emitters.
  const ordered=entries.slice().sort((a,b)=>radiusOf(b[0])-radiusOf(a[0])||a[0].localeCompare(b[0]))
  for(const [kind] of ordered) if(placed.length<8) { if(!place(kind,true)) place(kind) }
  for(let round=1;round<8&&placed.length<8;round++) for(const [kind,count] of ordered) if(round<count&&placed.length<8) place(kind)
  for(const {kind,pivot,normal,surface} of placed) {
    const barrelHeight=heightOf(kind),x=pivot.x,z=pivot.z,y=pivot.y-s*barrelHeight
    // Shallow armored bearing sits directly on the mounting face.
    const seat=new THREE.CylinderGeometry(s*.58,s*.70,.022,8)
    seat.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal))
    const seatCenter=surface.clone().addScaledVector(normal,.008)
    add(seat,'armor',seatCenter.x,seatCenter.y,seatCenter.z)
    const muzzleLength=kind==='railgun'?2.10:kind==='torpedo'?.92:kind==='missile'?.65:kind==='beam'||kind==='laser'?1.20:kind==='plasma'?1.43:kind==='exotic'||kind==='disruptor'?1.25:kind==='mine'||kind==='smartbomb'?0:kind==='flak'?1.38:1.71
    c.beginWeapon?.(kind,pivot,new THREE.Vector3(x+s*muzzleLength,pivot.y,z),Math.atan2(normal.z,normal.y),normal)
    rod(x,pivot.y-s*.19,z,s*.48,s*.10,'dark',false)
    rounded(x,pivot.y-s*.07,z,s*1.10,s*.94,s*.22,'hull')
    c.elevateWeapon?.()
    if(kind==='missile'||kind==='torpedo') {
      const torpedo=kind==='torpedo'
      rounded(x+.012,y+s*.55,z,s*(torpedo?1.7:1.15),s*1.12,s*.66,'armor')
      for(const offset of [-1,1]) for(const level of [-1,1]) {
        rod(x+s*(torpedo?.89:.62),y+s*(.55+level*.14),z+offset*s*.25,s*.115,s*.045,'dark')
      }
    } else if(kind==='beam'||kind==='laser') {
      rounded(x+s*.43,y+s*.42,z,s*1.42,s*.46,s*.37,'armor')
      rod(x+s*1.17,y+s*.42,z,s*.18,s*.06,'glass')
      for(const side of [-1,1]) slab(x+s*.40,y+s*.65,z+side*s*.31,s*.67,s*.09,s*.12,'metal')
    } else if(kind==='railgun') {
      for(const side of [-1,1]) {
        slab(x+s*.85,y+s*.43,z+side*s*.17,s*2.5,s*.13,s*.17,'metal')
        slab(x+s*.70,y+s*.54,z+side*s*.17,s*1.65,s*.045,.003,'accent')
      }
    } else if(kind==='plasma') {
      rod(x+s*.60,y+s*.48,z,s*.25,s*1.65,'dark')
      for(let j=0;j<4;j++) rod(x+s*(.10+j*.30),y+s*.48,z,s*.32,s*.08,'metal')
      rod(x+s*1.41,y+s*.48,z,s*.19,.004,'glass')
    } else if(kind==='exotic'||kind==='disruptor') {
      add(new THREE.TorusGeometry(s*.36,s*.065,6,16),'metal',x+s*.59,y+s*.45,z,new THREE.Euler(0,Math.PI/2,0))
      add(new THREE.OctahedronGeometry(s*.19),'glass',x+s*.59,y+s*.45,z)
      for(const side of [-1,1]) slab(x+s*.55,y+s*.42,z+side*s*.41,s*1.4,s*.13,s*.18,'armor')
    } else if(kind==='mine'||kind==='smartbomb') {
      rod(x,y+s*.45,z,s*.47,s*.26,'armor',false)
      add(new THREE.TorusGeometry(s*.38,s*.05,5,16),'accent',x,y+s*.62,z,new THREE.Euler(Math.PI/2,0,0))
      add(new THREE.SphereGeometry(s*.16,8,6),'glass',x,y+s*.62,z)
    } else {
      const barrels=kind==='autocannon'?4:kind==='flak'?3:2
      for(let j=0;j<barrels;j++) {
        const offset=(j-(barrels-1)/2)*s*.18
        rod(x+s*.78,y+s*.40,z+offset,s*.065,s*(kind==='flak'?1.1:1.8),'metal')
        rod(x+s*(kind==='flak'?1.32:1.65),y+s*.40,z+offset,s*.09,s*.12,'dark')
      }
    }
    c.endWeapon?.()
  }
  if(!known) return
  for(let i=0;i<Math.min(profile.cargo,4);i++) {
    const side=i%2?-1:1,x=-.20+Math.floor(i/2)*.33
    rounded(x,-h*.12,side*w*.99,.26,w*.48,h*.94,'armor')
    for(const band of [-1,1]) rounded(x+band*.075,-h*.12,side*w*.99,.012,w*.50,h*.97,'metal')
  }
  for(let i=0;i<Math.min(profile.mining+profile.salvage,4);i++) {
    const side=i%2?-1:1,x=.12-Math.floor(i/2)*.30,z=side*w*.86
    slab(x,-h*.14,side*w*.70,.10,w*.45,.025,'dark')
    slab(x,-h*.14,z,.14,.045,.038,'hull')
    rod(x+.10,-h*.14,z,.012,.22,'metal')
    if(i<profile.mining) rod(x+.23,-h*.14,z,.017,.018,'glass')
    else for(const claw of [-1,1]) slab(x+.22,-h*.14,z+claw*.017,.08,.009,.025,'metal')
  }
  for(let i=0;i<Math.min(profile.sensor,3);i++) {
    const x=-.32+i*.08,z=(i%2?1:-1)*w*.46
    const deck=c.deckAt?.(x,z)??h
    if(!Number.isFinite(deck)) continue
    rod(x,deck+.045,z,.004,.10,'metal',false)
    add(new THREE.SphereGeometry(.025,12,8,0,Math.PI*2,0,Math.PI*.48),'metal',x,deck+.095,z,new THREE.Euler(0,0,-.40))
    rod(x+.008,deck+.116,z,.002,.04,'dark',false)
  }
  for(let i=0;i<Math.min(profile.defense,6);i++) {
    const side=i%2?-1:1,x=-.26+Math.floor(i/2)*.22
    const deck=c.deckAt?.(x,side*w*.74)??h
    if(!Number.isFinite(deck)) continue
    slab(x,deck+.008,side*w*.74,.15,.043,.024,'armor')
    slab(x,deck+.022,side*w*.74,.06,.026,.005,'glass')
  }
  for(let i=0;i<Math.min(profile.utility,6);i++) {
    const x=-.35+Math.floor(i/2)*.14,z=(i%2?1:-1)*w*.60
    const deck=c.deckAt?.(x,z)??h
    if(!Number.isFinite(deck)) continue
    rounded(x,deck+.009,z,.08,.035,.026,i%3?'hull':'metal')
    slab(x,deck+.023,z,.057,.017,.004,'dark')
  }
}
