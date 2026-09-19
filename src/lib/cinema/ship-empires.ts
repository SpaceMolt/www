import * as THREE from 'three'
import { armorPlateGeometry } from './ship-plates'
import type { ShipAppearance } from './appearance'
import type { SpecialHullContext } from './ship-recipes'

/** Small Solarian craft retain filleted pressure sections, but sweep those
 * sections into a wedge. Scouts use compact shoulders; fighters carry a wider
 * delta shoulder. Donor hulls inherit this rule through hullEmpire/family. */
function buildSolarianSmallHull(fighter:boolean,c:SpecialHullContext) {
  const {add,rounded,slab,rod,engine,hero,w,h}=c
  type Ring=readonly [x:number,width:number,height:number,y?:number]
  const shell=(rings:readonly Ring[],material:Parameters<typeof add>[1])=>{
    const segments=hero?24:12,positions:number[]=[],indices:number[]=[]
    // A superellipse leaves broad pressure-panel faces with rounded corners.
    const section=(angle:number,radius:number)=>Math.sign(Math.sin(angle))*Math.sqrt(Math.abs(Math.sin(angle)))*radius
    for(const [x,width,height,y=0] of rings)for(let j=0;j<segments;j++) {
      const angle=j/segments*Math.PI*2
      positions.push(x,y+section(angle,height),section(angle+Math.PI/2,width))
    }
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++) {
      const a=i*segments+j,b=i*segments+(j+1)%segments
      indices.push(a,a+segments,b,b,a+segments,b+segments)
    }
    for(const end of [0,rings.length-1]) {
      const [x,width,height,y=0]=rings[end],base=positions.length/3
      positions.push(x,y,0)
      for(let j=0;j<segments;j++) {
        const angle=j/segments*Math.PI*2
        positions.push(x,y+section(angle,height),section(angle+Math.PI/2,width))
      }
      for(let j=0;j<segments;j++) {
        const a=base+1+j,b=base+1+(j+1)%segments
        indices.push(...(end===0?[base,a,b]:[base,b,a]))
      }
    }
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    add(geometry,material)
  }
  shell([
    [-.46,w*.56,h*.60],[-.35,w*.70,h*.75],[-.18,w*.69,h*.76],
    [.08,w*.45,h*.55],[.36,w*.22,h*.35],[.47,w*.12,h*.26],
    [.48,w*.105,h*.23],
  ],'armor')
  // A low swept shoulder grows out of the rear pressure hull, rather than
  // covering the wedge with a second rectangular deck or floating wings.
  const spread=fighter?1.06:.80
  shell([
    [-.40,w*.58,h*.10,-h*.24],[-.27,w*spread,h*.18,-h*.24],
    [-.19,w*spread,h*.18,-h*.24],[.17,w*.38,h*.12,-h*.24],
    [.25,w*.26,h*.07,-h*.24],
  ],'hull')
  // Thin dorsal fairing follows the same falling forebody. Its flat rear
  // pressure section leaves a useful mounting deck for sampled fitted hardware.
  shell([
    [-.32,w*.45,h*.20,h*.69],[-.22,w*.47,h*.20,h*.73],
    [-.08,w*.34,h*.13,h*.68],[.20,w*.15,h*.065,h*.44],
    [.30,w*.09,h*.025,h*.39],
  ],'hull')
  rounded(.479,0,0,.010,w*.19,h*.41,'dark')
  rounded(-.20,h*.86,0,.16,w*.55,h*.27,'armor')
  add(new THREE.BoxGeometry(.005,h*.15,w*.42),'glass',-.115,h*.89,0,new THREE.Euler(0,0,-.35))
  for(const side of [-1,1]) {
    engine(-.465,-h*.12,side*w*.43,.030)
    rounded(-.29,-h*.12,side*w*.68,.18,.010,h*.48,'dark')
    if(hero)for(let i=0;i<4;i++)rounded(-.35+i*.037,-h*.12,side*w*.705,.017,.009,h*.32,'metal')
    // Flush gold strips follow the sloped sides instead of restoring a square
    // silhouette. Rounded ends are retained on the small nose port above.
    const start=new THREE.Vector3(-.16,-h*.08,side*w*.687)
    const end=new THREE.Vector3(.43,-h*.02,side*w*.156)
    const direction=end.clone().sub(start),midpoint=start.clone().add(end).multiplyScalar(.5)
    const band=new THREE.BoxGeometry(direction.length(),.004,.003)
    band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),direction.normalize()))
    add(band,'accent',midpoint.x,midpoint.y,midpoint.z)
    slab(-.24,-h*.035,side*w*(fighter?.91:.71),.075,w*.12,.006,'armor')
  }
  rounded(-.30,h*.921,0,.09,w*.24,.004,'dark')
  if(hero) {
    for(let i=0;i<4;i++)slab(-.331+i*.020,h*.925,0,.008,w*.20,.003,'metal')
    rod(-.32,h*1.17,w*.20,.002,h*.38,'metal',false)
  }
}

/** Large construction primitives establish empire identity before fitted hardware. */
export function buildEmpireHull(appearance: ShipAppearance, c: SpecialHullContext): boolean {
  const empire = appearance.hullEmpire ?? appearance.empire
  if (!['solarian', 'nebula', 'crimson'].includes(empire)) return false
  const { add, slab, rounded, rod, engine, hero } = c
  const { family } = appearance
  if(empire==='solarian'&&(family==='fighter'||family==='scout')) {
    buildSolarianSmallHull(family==='fighter',c)
    return true
  }
  const heavyCombat=family==='capital'||family==='warship'
  const broadSolarian=empire==='solarian'&&heavyCombat
  // Combat pressure hulls use a low, broad shoulder deck. Cargo hulls retain
  // their tall rounded holds; catalog scale and fitted hardware stay unchanged.
  const w=c.w*(broadSolarian?1.40:1),h=c.h*(broadSolarian?.80:1)
  const small = ['fighter', 'scout', 'drone'].includes(family)
  const cargo = family === 'industrial' || family === 'support'
  const carrier = family === 'carrier'
  const capsule = (x:number,y:number,z:number,l:number,b:number,t:number,m:Parameters<typeof add>[1]='armor') => {
    const radius=b/2, geometry=new THREE.CapsuleGeometry(radius,Math.max(0,l-b),hero?8:3,hero?20:10)
    geometry.rotateZ(Math.PI/2);geometry.scale(1,t/b,1);add(geometry,m,x,y,z)
  }
  const box = (x:number,y:number,z:number,l:number,b:number,t:number,m:Parameters<typeof add>[1]='armor') => add(empire==='crimson'&&(m==='hull'||m==='armor')?armorPlateGeometry(l,b,t):new THREE.BoxGeometry(l,t,b),m,x,y,z)
  const brace = (a:THREE.Vector3,b:THREE.Vector3,thickness:number,m:Parameters<typeof add>[1]='metal') => {
    const direction=b.clone().sub(a),geometry=new THREE.BoxGeometry(direction.length(),thickness,thickness)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),direction.normalize()))
    const center=a.clone().add(b).multiplyScalar(.5)
    add(geometry,m,center.x,center.y,center.z)
  }
  const vents = (x:number,y:number,z:number,l:number,b:number) => {
    slab(x,y,z,l,b,.006,'dark')
    if(hero) for(let i=0;i<9;i++) slab(x-l*.43+i*l*.105,y+.004,z,l*.024,b*.85,.003,'metal')
  }
  if (empire === 'solarian') {
    // Quorum / Logistics Prime: broad flat faces with generous fillets.
    rounded(-.01,0,0,.94,w*1.72,h*1.8,'armor')
    rounded(-.23,h*.28,0,.40,w*1.94,h*1.94,'hull')
    rounded(-.24,h*.38,0,.37,w*1.88,h*1.9,'armor')
    // Three pressure-deck sections leave real lowered machinery channels
    // between them. Broad rounded shoulders still read as industrial modules.
    rounded(.085,h*.965,0,.61,w*.52,h*.19,'armor')
    for(const side of [-1,1]) {
      rounded(.085,h*.98,side*w*.59,.59,w*.31,h*.24,'armor')
      rounded(.095,h*.907,side*w*.355,.45,w*.15,.008,'dark')
      rounded(.08,h*.927,side*w*.285,.48,.007,.012,'metal')
      if(hero) {
        for(const station of [-.06,.09,.24]) rounded(station,h*.931,side*w*.357,.062,w*.105,.018,'hull')
        rod(.08,h*.94,side*w*.392,.003,.37,'metal')
      }
    }
    if(broadSolarian) {
      add(armorPlateGeometry(.29,w*1.38,h*.045,.13,.08),'dark',.28,h*1.035,0)
      add(armorPlateGeometry(.28,w*1.35,h*.095,.13,.08),'armor',.28,h*1.10,0)
      add(armorPlateGeometry(.31,w*1.76,h*.085,.12,.08),'armor',-.28,h*1.36,0)
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
      if(!cargo) {
        rounded(.055,-h*.26,side*w*.866,.35,.009,h*.61,'dark')
        for(const edge of [-1,1]) {
          rounded(.055,-h*.26+edge*h*.325,side*w*.88,.37,.019,h*.065,'hull')
          rounded(.055+edge*.18,-h*.26,side*w*.88,.018,.019,h*.65,'metal')
        }
        if(hero) for(let i=0;i<5;i++) slab(-.078+i*.065,-h*.26,side*w*.883,.031,.009,h*.39,'metal')
      }
      if(heavyCombat) {
        // One grouped aft service panel balances the larger forward machinery
        // bay; the rest of the pressure shell keeps broad quiet armor faces.
        rounded(-.285,-h*.10,side*w*.975,.225,.008,h*.49,'dark')
        for(const edge of [-1,1]) rounded(-.285+edge*.113,-h*.10,side*w*.985,.013,.013,h*.51,'hull')
        if(hero) for(let i=0;i<4;i++) rounded(-.366+i*.054,-h*.10,side*w*.985,.025,.010,h*.37,'metal')
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
    rounded(.15,h*.916,0,.50,w*.42,.008,'accent')
    rounded(-.22,h*.83,0,.34,w*1.13,h*.60,'armor')
    // A single continuous observation ring is visibly sandwiched between the
    // bridge foundation and an overhanging gold roof, including at distant LOD.
    rounded(-.21,h*1.19,0,.29,w*.96,h*.16,'dark')
    rounded(-.21,h*1.32,0,.32,w*1.10,h*.17,'armor')
    rounded(-.21,h*1.414,0,.22,w*.61,.007,'accent')
    slab(-.063,h*1.19,0,.003,w*.78,h*.075,'glass')
    for(const side of [-1,1]) {
      slab(-.21,h*1.19,side*w*.481,.235,.003,h*.075,'glass')
    }
    add(armorPlateGeometry(Math.hypot(.23,h*.20),w*.66,h*.15,.15,.15),'armor',.04,h*.98,0,new THREE.Euler(0,0,-Math.atan2(h*.20,.23)))
    for(const side of [-1,1]) {
      const holdLength=cargo?.67:small?.43:.57
      const holdWidth=w*(cargo?.97:.68), holdHeight=h*(cargo?1.95:1.3)
      const x=cargo?.015:-.08,z=side*w*(cargo?.81:.79)
      capsule(x,0,z,holdLength,holdWidth,holdHeight,'armor')
      // Root fairings carry the pod collars into the central pressure hull.
      add(armorPlateGeometry(.46,w*.43,h*.55,.29,.31),'hull',-.075,h*.70,side*w*.53)
      add(armorPlateGeometry(.42,w*.35,h*.16,.20,.29),'armor',-.06,h*.965,side*w*.53)
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
  } else {
    // Crimson: sloped shoulder armor, blunt inclined jaws, and open machinery gaps.
    box(-.015,0,0,.92,w*1.40,h*1.37,'dark')
    // A continuous backbone remains visible between the independent armor caps.
    for(const side of [-1,1]) {
      box(-.04,h*.31,side*w*.77,.79,w*.14,h*.14,'metal')
      box(-.04,-h*.44,side*w*.77,.79,w*.13,h*.14,'metal')
      for(const x of [-.165,.125]) {
        box(x,-h*.04,side*w*.79,.045,.016,h*.85,'dark')
        brace(new THREE.Vector3(x-.041,-h*.44,side*w*.80),new THREE.Vector3(x+.041,h*.37,side*w*.80),.012)
        brace(new THREE.Vector3(x+.041,-h*.44,side*w*.795),new THREE.Vector3(x-.041,h*.37,side*w*.795),.010,'hull')
        if(hero) for(let j=0;j<3;j++) box(x,-h*.29+j*h*.24,side*w*.81,.042,.008,h*.045,'metal')
      }
    }
    for(let i=0;i<3;i++) {
      const x=-.31+i*.29
      add(armorPlateGeometry(.225,w*1.65,h*1.68,.33,.18),'hull',x,0,0)
      add(armorPlateGeometry(.225,w*.76,h*.14,.15,.16),'armor',x,h*.85,0)
      for(const side of [-1,1]) {
        const slope=Math.atan2(h*.554,w*.545)
        add(armorPlateGeometry(.219,Math.hypot(w*.545,h*.554),h*.075,.10,.09),'armor',x,h*.563,side*w*.5525,new THREE.Euler(side*slope,0,0))
        if(heavyCombat&&i===1) {
          const normal=new THREE.Vector3(0,Math.cos(slope),side*Math.sin(slope))
          const center=new THREE.Vector3(x,h*.563,side*w*.5525).addScaledVector(normal,h*.045+.002)
          const panelWidth=Math.hypot(w*.545,h*.554)*.64
          add(armorPlateGeometry(.146,panelWidth,.006,.08,.05),'dark',center.x,center.y,center.z,new THREE.Euler(side*slope,0,0))
          if(hero) for(let vent=0;vent<4;vent++) {
            const at=center.clone().addScaledVector(normal,.005)
            add(new THREE.BoxGeometry(.019,.003,panelWidth*.79),'metal',x-.0525+vent*.035,at.y,at.z,new THREE.Euler(side*slope,0,0))
          }
        }
        box(x,-h*.10,side*w*.80,.219,.024,h*.78,'armor')
        box(x+.025,-h*.06,side*w*.844,.12,.014,h*.40,'hull')
        if(hero) {
          box(x-.05,h*.932,side*w*.25,.013,w*.17,.009,'metal')
          for(let j=0;j<3;j++) box(x-.057+j*.05,-h*.06,side*w*.884,.022,.004,h*.25,'dark')
        }
      }
    }
    // Exposed steel collars carry the segmented armor across the machinery seams.
    for(const x of [-.165,.125]) add(armorPlateGeometry(.115,w*1.44,h*.30),'metal',x,h*.63,0)
    // Twin blunt jaws leave a visible axial recess instead of a pointed nose.
    box(.40,-h*.42,0,.12,w*.78,h*.18,'metal')
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
