import * as THREE from 'three'
import type { CinemaHardware } from './hardware'
import type { ShipFamily } from './appearance'
import type { CinemaWeaponFamily } from './weapons'
import type { SpecialHullContext } from './ship-recipes'

/** Bounded representative external equipment; counts describe a fit, not literal sockets. */
export function buildFittedHardware(profile: CinemaHardware | undefined, family: ShipFamily, c: SpecialHullContext & { deckAt?: (x:number,z:number)=>number }) {
  const { add,slab,rounded,rod,h,w,hero }=c
  const known=profile && profile.source!=='unknown'
  const legacyCount=family==='fighter'?2:family==='warship'?3:family==='capital'?4:0
  const weapons=known?profile.weapons:({kinetic:legacyCount} as Partial<Record<CinemaWeaponFamily,number>>)
  // Distant hulls omit all fine equipment: their silhouettes remain a bounded set.
  if(!hero) return
  const entries=Object.entries(weapons).filter(([,count])=>count && count>0) as [CinemaWeaponFamily,number][]
  // One of every family first, then extra mounts round-robin, at most twelve.
  const mounts:CinemaWeaponFamily[]=[]
  for(let round=0;round<8 && mounts.length<12;round++) for(const [kind,count] of entries) {
    if(round<count && mounts.length<12) mounts.push(kind)
  }
  for(let i=0;i<mounts.length;i++) {
    const kind=mounts[i],row=Math.floor(i/2),side=i%2?-1:1
    let x=.30-row*.092,z=side*w*.35,deck=c.deckAt?.(x,z)??h*1.04
    if(!Number.isFinite(deck)){z=0;deck=c.deckAt?.(x,z)??h}
    if(!Number.isFinite(deck)){x=0;deck=c.deckAt?.(x,z)??h}
    if(!Number.isFinite(deck)) continue
    const y=deck+.003
    const s=family==='fighter'||family==='scout'?.038:.052
    rod(x,y,z,s*.48,s*.22,'dark',false)
    rounded(x,y+s*.22,z,s,s*.83,s*.40,'hull')
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
