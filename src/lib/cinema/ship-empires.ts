import * as THREE from 'three'
import { armorPlateGeometry } from './ship-plates'
import type { ShipAppearance } from './appearance'
import type { SpecialHullContext } from './ship-recipes'

/** Large construction primitives establish empire identity before fitted hardware. */
export function buildEmpireHull(appearance: ShipAppearance, c: SpecialHullContext): boolean {
  const empire = appearance.hullEmpire ?? appearance.empire
  if (!['solarian', 'nebula', 'crimson'].includes(empire)) return false
  const { add, slab, rounded, rod, engine, h, w, hero } = c
  const { family } = appearance
  const small = ['fighter', 'scout', 'drone'].includes(family)
  const cargo = family === 'industrial' || family === 'support'
  const carrier = family === 'carrier'
  const capsule = (x:number,y:number,z:number,l:number,b:number,t:number,m:Parameters<typeof add>[1]='armor') => {
    const radius=b/2, geometry=new THREE.CapsuleGeometry(radius,Math.max(0,l-b),hero?8:3,hero?20:10)
    geometry.rotateZ(Math.PI/2);geometry.scale(1,t/b,1);add(geometry,m,x,y,z)
  }
  const box = (x:number,y:number,z:number,l:number,b:number,t:number,m:Parameters<typeof add>[1]='armor') => add(empire==='crimson'&&(m==='hull'||m==='armor')?armorPlateGeometry(l,b,t):new THREE.BoxGeometry(l,t,b),m,x,y,z)
  const vents = (x:number,y:number,z:number,l:number,b:number) => {
    slab(x,y,z,l,b,.006,'dark')
    if(hero) for(let i=0;i<9;i++) slab(x-l*.43+i*l*.105,y+.004,z,l*.024,b*.85,.003,'metal')
  }
  if (empire === 'solarian') {
    // Lemma / Quorum / Logistics Prime: broad flat faces with generous fillets.
    rounded(-.01,0,0,.94,w*1.72,h*1.8,'armor')
    rounded(-.23,h*.28,0,.40,w*1.94,h*1.94,'hull')
    rounded(-.24,h*.38,0,.37,w*1.88,h*1.9,'armor')
    rounded(.085,h*.72,0,.61,w*1.47,h*.48,'armor')
    // A shallow deck lip and inset service channel establish a maintained,
    // layered pressure hull without making every edge another rounded box.
    if(hero) {
      add(armorPlateGeometry(.58,w*1.40,.009,.10,.04),'hull',.095,h*.957,0)
      add(armorPlateGeometry(.54,w*1.31,.006,.08,.04),'armor',.095,h*1.001,0)
      slab(.11,h*1.04,0,.36,w*.16,.007,'dark')
      add(armorPlateGeometry(.33,w*.10,.008,.10,.08),'hull',.11,h*1.09,0)
    }
    rounded(.46,-h*.02,0,.019,w*1.23,h*1.14,'dark')
    // A flush overlapping apron joins the raised stern shell to the foredeck.
    add(armorPlateGeometry(Math.hypot(.15,h*.36),w*1.35,h*.08,.06,.025),'hull',-.045,h*1.11,0,new THREE.Euler(0,0,-Math.atan2(h*.36,.15)))
    // Fine gold bands wrap both sides; glazing remains recessed and restrained.
    for(const side of [-1,1]) {
      rounded(.015,-h*.08,side*w*.862,.78,.004,.007,'accent')
      rounded(-.25,h*.76,side*w*.82,.36,.004,.007,'accent')
      rounded(-.31,h*.85,side*w*.60,.22,w*.40,h*.35,'armor')
      engine(-.49,-h*.18,side*w*.52,small?.030:.044)
      if(hero && !cargo) {
        // The rim surrounds a machinery bay rather than a row of floating tiles.
        rounded(.055,-h*.37,side*w*.864,.28,.010,h*.40,'metal')
        rounded(.055,-h*.37,side*w*.872,.258,.008,h*.30,'dark')
        for(let i=0;i<6;i++) slab(-.047+i*.04,-h*.37,side*w*.879,.009,.005,h*.23,'hull')
      }
      if(hero) for(let i=0;i<5;i++) {
        add(armorPlateGeometry(.10,w*.48,.004,.045,.025),'hull',-.25+i*.135,h*.91,side*w*.40)
        if(cargo) slab(-.235+i*.135,-h*.47,side*w*.865,.06,.004,h*.27,'dark')
      }
    }
    // Low stacked bridge follows the hull, avoiding a naval tower.
    rounded(-.26,h*1.16,0,.19,w*.85,h*.43,'hull')
    rounded(-.255,h*1.30,0,.18,w*.84,h*.24,'armor')
    slab(-.158,h*1.21,0,.004,w*.67,h*.14,'glass')
    if(cargo) {
      for(const side of [-1,1]) {
        rounded(.01,-h*.10,side*w*.75,.68,w*.60,h*1.58,'armor')
        for(const x of [-.20,.18]) rounded(x,0,side*w*.76,.017,w*.62,h*1.62,'accent')
      }
    }
    if(carrier) {
      for(const side of [-1,1]) {
        rounded(0,-h*.25,side*w*.91,.66,w*.54,h*1.25,'armor')
        box(.335,-h*.27,side*w*.91,.007,w*.37,h*.74,'dark')
        box(.34,-h*.56,side*w*.91,.009,w*.32,.006,'windows')
      }
    }
    vents(-.28,h*1.42,0,.12,w*.50)
    if(hero) {
      rod(-.35,h*1.78,w*.24,.0025,h*.50,'metal',false)
      rounded(.27,h*.965,0,.16,.005,.003,'accent')
    }
  } else if (empire === 'nebula') {
    // Gold pressure hulls and green inset enamel, including deliberately outsized holds.
    rounded(-.03,0,0,.92,w*1.23,h*1.42,'armor')
    rounded(.12,h*.26,0,.68,w*.96,h*1.29,'armor')
    rounded(.10,h*.87,0,.66,w*.48,.014,'accent')
    rounded(-.22,h*.87,0,.32,w*1.13,h*.63,'armor')
    rounded(-.21,h*1.24,0,.26,w*.90,h*.16,'accent')
    rounded(-.21,h*1.36,0,.20,w*.68,h*.18,'armor')
    slab(-.101,h*1.33,0,.004,w*.58,h*.11,'glass')
    // The observation band sits under an overhanging roof, not on a bright block.
    if(hero) {
      rounded(-.21,h*1.20,0,.27,w*.92,h*.075,'dark')
      for(const side of [-1,1]) {
        slab(-.205,h*1.23,side*w*.458,.19,.003,h*.025,'glass')
        rounded(-.21,h*1.30,side*w*.42,.22,w*.06,.006,'metal')
      }
    }
    for(const side of [-1,1]) {
      const holdLength=cargo?.67:small?.43:.57
      const holdWidth=w*(cargo?.97:.68), holdHeight=h*(cargo?1.95:1.3)
      const x=cargo?.015:-.08,z=side*w*(cargo?.81:.79)
      capsule(x,0,z,holdLength,holdWidth,holdHeight,'armor')
      // Root fairings carry the pod collars into the central pressure hull.
      rounded(-.08,h*.56,side*w*.53,.37,w*.38,h*.44,'hull')
      // Thin equatorial trim follows the same capsule outline.
      capsule(x,0,z,holdLength+.003,holdWidth+.004,holdHeight*.12,'hull')
      capsule(x,0,z,holdLength+.004,holdWidth+.005,holdHeight*.038,'accent')
      for(const band of [-1,1]) {
        const ring=new THREE.TorusGeometry(holdWidth*.505,.004,5,hero?24:12)
        ring.rotateY(Math.PI/2);ring.scale(1,holdHeight/holdWidth,1)
        add(ring,'hull',x+band*(holdLength-holdWidth)*.28,0,z)
        if(hero) {
          // Buckles and short saddles explain how the hold joins its collar.
          rounded(x+band*(holdLength-holdWidth)*.28,holdHeight*.49,z,.024,holdWidth*.25,.009,'metal')
          slab(x+band*(holdLength-holdWidth)*.28,holdHeight*.50+.005,z,.012,holdWidth*.14,.003,'dark')
        }
      }
      engine(-.46,-h*.12,side*w*.69,small?.032:.05)
      if(hero) vents(-.24,h*.70,side*w*.73,.13,w*.31)
      if(carrier) {
        box(.20,-h*.10,side*w*.79,.008,w*.45,h*.71,'dark')
        box(.205,-h*.40,side*w*.79,.01,w*.40,.006,'windows')
      }
    }
    if(!small) {
      rounded(-.08,h*1.01,w*.59,.43,w*.32,h*.49,'metal')
      rounded(-.08,h*1.01,-w*.59,.43,w*.32,h*.49,'metal')
    }
  } else {
    // Crimson: sloped shoulder armor, blunt inclined jaws, and open machinery gaps.
    box(-.015,0,0,.92,w*1.40,h*1.37,'dark')
    // A continuous backbone remains visible between the independent armor caps.
    if(hero) for(const side of [-1,1]) {
      box(-.04,h*.28,side*w*.69,.79,w*.16,h*.24,'metal')
      box(-.04,-h*.40,side*w*.69,.79,w*.13,h*.11,'hull')
      for(const x of [-.165,.125]) {
        box(x,h*.40,side*w*.77,.048,.015,h*.52,'dark')
        for(let j=0;j<4;j++) box(x,-h*.01+j*h*.15,side*w*.78,.037,.008,h*.047,'metal')
      }
    }
    for(let i=0;i<3;i++) {
      const x=-.31+i*.29
      box(x,0,0,.225,w*1.65,h*1.78,'hull')
      box(x,h*.83,0,.225,w*1.61,.025,'armor')
      for(const side of [-1,1]) {
        box(x,h*.15,side*w*.79,.226,.034,h*1.48,'armor')
        box(x+.025,h*.47,side*w*.891,.12,.018,h*.33,'hull')
        if(hero) {
          box(x-.05,h*.87,side*w*.42,.013,w*.47,.013,'metal')
          for(let j=0;j<3;j++) box(x-.057+j*.05,h*.03,side*w*.89,.022,.004,h*.29,'dark')
        }
      }
    }
    // Exposed steel collars carry the segmented armor across the machinery seams.
    for(const x of [-.165,.125]) add(armorPlateGeometry(.115,w*1.44,h*.30),'metal',x,h*.63,0)
    // Twin blunt jaws leave a visible axial recess instead of a pointed nose.
    for(const side of [-1,1]) {
      box(.39,0,side*w*.53,.22,w*.59,h*1.85,'armor')
      box(.505,0,side*w*.53,.012,w*.43,h*1.38,'dark')
      box(.30,h*.99,side*w*.52,.36,w*.18,.014,'metal')
      box(-.30,h*.08,side*w*.95,.25,w*.45,h*1.32,'armor')
      engine(-.49,0,side*w*.52,small?.035:.049)
      if(cargo) {
        for(let i=0;i<3;i++) box(-.23+i*.24,-h*.20,side*w*.98,.19,w*.52,h*1.43,i%2?'hull':'armor')
      }
      if(carrier) box(.25,-h*.30,side*w*.65,.012,w*.38,h*.66,'dark')
    }
    box(-.29,h*1.11,0,.24,w*1.1,h*.45,'armor')
    box(-.162,h*1.12,0,.011,w*.74,h*.17,'glass')
    vents(-.25,h*1.35,0,.12,w*.65)
    if(hero) for(let i=0;i<5;i++) {
      box(-.14+i*.035,h*.80,0,.012,w*.60,.04,'metal')
      box(.45,-h*.15+i*h*.11,0,.01,w*.18,.005,'windows')
    }
  }
  return true
}
