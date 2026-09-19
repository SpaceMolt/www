import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { armorPlateGeometry } from './ship-plates'
import type { ShipAppearance } from './appearance'
import type { SpecialHullContext, SpecialHullMaterial } from './ship-recipes'

/** Station construction shares the hull material batches. Dimensions stay in a
 * fixed envelope; LOD removes fittings rather than changing the architecture. */
export function buildStationHull(appearance:ShipAppearance,c:SpecialHullContext):void {
  const {add,hero}=c, empire=appearance.hullEmpire??appearance.empire
  const salvage=empire==='outerrim'||empire==='pirate'
  const facets=empire==='crimson'?8:hero?32:16
  const point=(r:number,y:number,a:number)=>new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)
  const part=(a:number,r:number,y:number,l:number,w:number,h:number,m:SpecialHullMaterial='armor')=>{
    const g=Math.min(l,w,h)<.012?new THREE.BoxGeometry(l,h,w):empire==='crimson'&&(m==='armor'||m==='hull')?armorPlateGeometry(l,w,h,.30,.12):
      new RoundedBoxGeometry(l,h,w,hero&&Math.min(l,w,h)>.025?2:1,Math.min(l,w,h)*(empire==='solarian'?.13:.07))
    const p=point(r,y,a);add(g,m,p.x,p.y,p.z,new THREE.Euler(0,-a,0))
  }
  const cylinder=(radius:number,height:number,y:number,m:SpecialHullMaterial='armor',bottom=radius)=>add(new THREE.CylinderGeometry(radius,bottom,height,facets),m,0,y,0)
  const ring=(radius:number,tube:number,y:number,m:SpecialHullMaterial='metal',arc=Math.PI*2,start=0)=>{
    const g=new THREE.TorusGeometry(radius,tube,hero?8:5,Math.max(8,Math.ceil((hero?72:32)*arc/(Math.PI*2))),arc)
    g.rotateX(Math.PI/2);g.rotateY(-start);add(g,m,0,y,0)
  }
  const segment=(radius:number,width:number,height:number,y:number,start:number,arc:number,m:SpecialHullMaterial='armor')=>{
    const shape=new THREE.Shape(),steps=hero?10:5
    for(let i=0;i<=steps;i++){const a=start+arc*i/steps,x=Math.cos(a)*(radius+width/2),z=Math.sin(a)*(radius+width/2);if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z)}
    for(let i=steps;i>=0;i--){const a=start+arc*i/steps;shape.lineTo(Math.cos(a)*(radius-width/2),Math.sin(a)*(radius-width/2))}
    shape.closePath()
    const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.0025,bevelThickness:.0025,bevelSegments:1,steps:1,curveSegments:steps})
    g.rotateX(Math.PI/2);add(g,m,0,y+height/2,0)
  }
  const beam=(a:THREE.Vector3,b:THREE.Vector3,r=.007,m:SpecialHullMaterial='metal')=>{
    const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,d.length(),hero?6:4)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()))
    const p=a.clone().add(b).multiplyScalar(.5);add(g,m,p.x,p.y,p.z)
  }
  const windows=(a:number,r:number,y:number,count=5)=>{
    part(a,r,y,.006,.095,.023,'dark')
    if(hero)for(let i=0;i<count;i++){
      const p=point(r+.004,y,a).add(new THREE.Vector3(-Math.sin(a),0,Math.cos(a)).multiplyScalar((i-(count-1)/2)*.016))
      add(new THREE.BoxGeometry(.003,.005,.009),'windows',p.x,p.y,p.z,new THREE.Euler(0,-a,0))
    }
  }
  const dock=(a:number,r=.46,y=.04)=>{
    // Recessed cavity, projecting side jaws, inset door and approach lights.
    part(a,r-.02,y-.034,.20,.106,.008,'dark')
    part(a,r-.056,y+.040,.132,.124,.016,'armor')
    part(a,r-.060,y+.051,.104,.101,.006,'hull')
    for(const side of [-1,1]){
      const p=point(r,y,a).add(new THREE.Vector3(-Math.sin(a),0,Math.cos(a)).multiplyScalar(side*.058))
      const g=new RoundedBoxGeometry(.16,.065,.020,1,.003)
      add(g,'armor',p.x,p.y,p.z,new THREE.Euler(0,-a,0))
      if(hero)for(let j=0;j<3;j++){
        const q=p.clone().addScaledVector(point(1,0,a),(j-1)*.045)
        add(new THREE.BoxGeometry(.005,.003,.004),'windows',q.x,q.y+.035,q.z,new THREE.Euler(0,-a,0))
        const rib=q.clone().addScaledVector(new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),-side*.012)
        add(new THREE.BoxGeometry(.004,.057,.005),'metal',rib.x,rib.y,rib.z,new THREE.Euler(0,-a,0))
      }
    }
    part(a,r-.116,y,.012,.092,.072,'hull')
    part(a,r-.108,y,.005,.066,.043,'dark')
    if(hero){
      part(a,r-.104,y+.004,.003,.047,.002,'metal')
      for(let j=0;j<4;j++)part(a,r-.06+j*.039,y-.028,.012,.003,.002,'accent')
      // Smaller freight-door cutouts and a vented roof supply a human-scale
      // reference inside the much larger open arrival bay.
      part(a,r-.103,y-.015,.003,.008,.014,'metal')
      for(let j=0;j<5;j++)part(a,r-.094+j*.015,y+.055,.007,.034,.003,'dark')
    }
  }
  const radiator=(a:number,r:number,y:number)=>{
    part(a,r,y,.15,.10,.012,'metal');part(a,r,y+.008,.137,.087,.005,'dark')
    if(hero)for(let i=0;i<7;i++)part(a,r-.056+i*.018,y+.012,.007,.081,.003,'hull')
  }
  const hub=(radius=.12)=>{
    cylinder(radius*.84,.51,-.015,'dark',radius)
    for(const [y,r,h] of [[-.25,radius*.67,.07],[-.16,radius*1.13,.08],[.01,radius,.23],[.20,radius*.83,.10],[.285,radius*.55,.045]]){
      cylinder(r,h,y,'hull',r*1.05);cylinder(r*1.03,.009,y+h/2,'armor')
    }
    ring(radius*1.03,.007,-.115,'metal');ring(radius*.86,.008,.242,'accent')
    cylinder(radius*.84,.024,.191,'glass')
    if(hero)for(let i=0;i<12;i++){
      const a=i*Math.PI/6
      windows(a,radius*.88,.202,3)
      for(const y of [-.038,.009,.056])windows(a,radius*1.03,y,4)
      part(a,radius*1.04,.124,.009,.026,.047,'metal')
      part(a,radius*1.087,.124,.003,.018,.032,'dark')
    }
    cylinder(.012,.074,.335,'metal')
    if(hero){
      for(const side of [-1,1]){
        const p=point(.028,.346,side*Math.PI/2)
        add(new THREE.BoxGeometry(.018,.035,.006),'dark',p.x,p.y,p.z)
        beam(new THREE.Vector3(0,.31,0),p,.002)
      }
      cylinder(.003,.065,.370,'metal')
    }
  }
  const spokes=(count:number,radius:number,y:number)=>{
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count
      part(a,(radius+.10)/2,y,radius-.10,.047,.039,'hull')
      part(a,(radius+.10)/2,y+.022,radius-.12,.022,.006,'metal')
      if(hero)for(const side of [-1,1])beam(point(.13,y-.022,a+side*.05),point(radius,y-.022,a+side*.016),.003)
      if(hero)for(let j=0;j<4;j++){
        part(a,.16+j*.043,y+.029,.018,.016,.008,j%2?'dark':'armor')
        part(a+.025,.16+j*.043,y+.028,.025,.003,.003,'metal')
      }
    }
  }

  if(empire==='voidborn'){
    // A grown spindle and three overlapping shell crescents enclose real gaps.
    const profile=[[-.31,.016],[-.23,.065],[-.10,.105],[.07,.092],[.21,.060],[.34,.012]]
    const spindleRadius=(y:number)=>{
      const upper=profile.findIndex(([height])=>height>=y)
      if(upper<=0)return profile[upper<0?profile.length-1:0][1]
      const [lowY,lowR]=profile[upper-1],[highY,highR]=profile[upper]
      return THREE.MathUtils.lerp(lowR,highR,(y-lowY)/(highY-lowY))
    }
    add(new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r,y)),hero?32:16),'hull')
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3
      ring(.31,.026,.04,'dark',Math.PI*.53,a+.10)
      segment(.32,.070,.030,.065,a,Math.PI*.54)
      segment(.29,.050,.024,-.10,a+.26,Math.PI*.48,'hull')
      const curve=new THREE.CatmullRomCurve3([point(.08,.21,a),point(.20,.16,a+.17),point(.34,.06,a+.31),point(.37,-.02,a+.56)])
      add(new THREE.TubeGeometry(curve,hero?18:9,.023,hero?8:5,false),'armor')
      const shard=new THREE.SphereGeometry(1,hero?16:8,hero?10:6);shard.scale(.044,.17,.056);shard.rotateZ(-.35)
      const p=point(.23,-.14,a+.65);add(shard,'hull',p.x,p.y,p.z,new THREE.Euler(0,-a,0))
      dock(a+.57,.43,.025)
      part(a+.32,.335,.103,.07,.072,.022,'hull')
      if(hero){
        ring(.075,.003,.12,'glass',Math.PI*.42,a)
        part(a+.7,.26,-.065,.07,.025,.008,'glass')
        // Evaluate the shell radius at every path sample: interpolating radial
        // control points can pull an otherwise surface-bound vein into the hull.
        const vein=new class extends THREE.Curve<THREE.Vector3>{
          constructor(){super()}
          getPoint(t:number,target=new THREE.Vector3()){
            const y=THREE.MathUtils.lerp(.27,-.26,t),r=spindleRadius(y)+.0025
            const angle=a+.4*t+.025*Math.sin(t*Math.PI*2)
            return target.set(Math.cos(angle)*r,y,Math.sin(angle)*r)
          }
        }()
        add(new THREE.TubeGeometry(vein,36,.003,5,false),'glass')
        const node=point(.092,.075,a+.1)
        add(new THREE.SphereGeometry(.017,12,8),'glass',node.x,node.y,node.z)
        for(let j=0;j<7;j++){
          const b=a+.13+j*.19,p=point(.356,.055,b)
          add(new THREE.BoxGeometry(.003,.003,.005),'windows',p.x,p.y,p.z,new THREE.Euler(0,-b,0))
        }
      }
    }
    add(new THREE.SphereGeometry(.035,hero?20:10,hero?12:6),'glass',0,.075,0)
  }else if(empire==='solarian'){
    hub(.118);spokes(8,.34,.04)
    ring(.315,.017,.025,'dark');ring(.315,.006,-.024,'accent')
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4
      segment(.32,.086,.082,.047,a+.04,Math.PI/4-.08)
      part(a,.32,.102,.068,.14,.022,'hull');part(a,.32,.116,.055,.116,.008,'armor')
      windows(a,.366,.057)
      if(hero)for(const y of [.024,.072])for(const offset of [-.20,.20])windows(a+offset,.366,y,4)
      if(i%2===0)dock(a,.455,.025);else radiator(a,.435,-.012)
      if(hero){part(a,.278,.092,.009,.10,.006,'accent');for(let j=0;j<3;j++)part(a,.31+(j-1)*.018,.123,.011,.034,.004,'metal')}
      if(hero)for(const side of [-1,1]){
        beam(point(.15,.069,a+side*.043),point(.265,.069,a+side*.024),.0025,'metal')
        part(a+side*.04,.247,.075,.039,.014,.014,'armor')
      }
    }
    ring(.21,.018,-.168,'hull');spokes(4,.21,-.168)
    for(let i=0;i<4;i++)part(i*Math.PI/2,.21,-.17,.09,.105,.075,'armor')
  }else if(empire==='crimson'){
    hub(.14);spokes(6,.355,.035)
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,b=(i+1)*Math.PI/3
      beam(point(.34,.00,a),point(.34,.00,b),.014)
      beam(point(.34,-.09,a),point(.34,-.09,b),.009)
      beam(point(.34,.00,a),point(.34,-.09,b),.005)
      part(a,.34,.032,.145,.168,.115,'hull')
      part(a,.34,.102,.14,.14,.032,'armor')
      part(a,.385,.061,.05,.087,.014,'dark')
      if(hero)for(let j=0;j<5;j++)part(a+(j-2)*.038,.389,.072,.026,.006,.006,'metal')
      part(a,.205,-.12,.20,.049,.049,'metal')
      part(a,.325,-.132,.15,.123,.060,'armor')
      windows(a,.418,-.002,4)
      if(hero){
        part(a,.389,.017,.031,.068,.023,'armor');part(a,.408,.017,.004,.048,.009,'dark')
        for(let j=0;j<4;j++)part(a+(j-1.5)*.022,.411,.017,.002,.003,.004,'windows')
      }
      if(i%2===0)dock(a+Math.PI/6,.45,-.042)
    }
    cylinder(.16,.06,.07,'armor',.19)
    for(let i=0;i<6;i++)radiator(i*Math.PI/3,.24,-.20)
  }else if(empire==='nebula'){
    hub(.13);spokes(6,.325,.03)
    ring(.305,.043,.044,'armor');ring(.306,.006,.088,'accent')
    ring(.22,.021,-.16,'hull');spokes(3,.22,-.16)
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,r=i%2?.40:.425
      const g=new THREE.CapsuleGeometry(i%2?.044:.061,i%2?.09:.12,hero?6:3,hero?16:8)
      g.rotateZ(Math.PI/2);g.rotateY(-a);const p=point(r,-.01,a);add(g,'armor',p.x,p.y,p.z)
      for(const axial of [-.04,.04]){
        const q=point(r+axial,-.01,a),collar=new THREE.TorusGeometry(i%2?.045:.062,.004,5,hero?24:12)
        collar.rotateY(Math.PI/2);collar.rotateY(-a);add(collar,'hull',q.x,q.y,q.z)
      }
      part(a,.315,.096,.075,.093,.024,'hull');part(a,.315,.110,.058,.07,.009,'accent')
      windows(a,.338,.049)
      if(hero){
        for(const offset of [-.21,.21])windows(a+offset,.338,.049,4)
        part(a,r,.052,.068,.025,.005,'dark')
        for(let j=0;j<4;j++)part(a,r-.025+j*.016,.056,.005,.021,.003,'metal')
      }
      if(i%2===0)dock(a+Math.PI/6,.44,-.048)
    }
    cylinder(.17,.018,.225,'armor');cylinder(.162,.014,.21,'glass')
  }else{
    // Open utility wheel: the Rim and pirate branches retain the same load-
    // bearing frame, with different fitted pressure modules and replacement skins.
    hub(salvage?.10:.115)
    const count=salvage?6:8, radius=.33
    spokes(count,radius,.025)
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count,b=(i+1)*Math.PI*2/count
      beam(point(radius,.062,a),point(radius,.062,b),.010,'hull')
      beam(point(radius,-.042,a),point(radius,-.042,b),.007)
      beam(point(radius,.062,a),point(radius,-.042,b),.004)
      beam(point(radius,-.042,a),point(radius,.062,b),.004)
      const uneven=salvage?(i%3-1)*.012:0
      part(a,radius,.027,.10,.13+uneven,.078,i%3===1?'hull':'armor')
      windows(a,radius+.053,.034,4)
      if(i%2===0)dock(a,.46,.002)
      else radiator(a,.44,-.02)
      part(a,radius,.077,.075,.083,.009,'dark')
      part(a,radius,.085,.064,.074,.008,salvage&&i%2?'metal':'armor')
      if(hero)for(const side of [-1,1])part(a+side*.075,radius,.094,.047,.003,.005,'metal')
      if(salvage){
        part(a+.11,.225,-.14,.20,.080,.063,i%2?'hull':'armor')
        if(hero){
          for(let j=0;j<7;j++)part(a+.11,.15+j*.023,-.105,.004,.076,.006,'metal')
          for(const side of [-1,1]){
            beam(point(.20,-.10,a+side*.10),point(.29,-.035,a+side*.10),.003,'metal')
            beam(point(.18,.063,a+side*.06),point(.285,.063,a+side*.038),.003,'metal')
          }
          part(a+.11,.21,-.101,.035,.037,.009,'dark')
          part(a+.11,.21,-.094,.025,.027,.007,i%2?'armor':'hull')
        }
      }
    }
    ring(.205,.015,-.165,'dark');spokes(4,.205,-.165)
    if(empire==='pirate'){
      // Off-axis salvage gantry, improvised armored command annex, and a
      // replacement ring section read as conversion rather than a red repaint.
      part(.35,.18,.23,.24,.11,.09,'hull');part(.35,.18,.283,.19,.095,.014,'armor')
      for(const side of [-1,1])beam(point(.20,-.19,2.1+side*.13),point(.48,-.19,2.1+side*.13),.006)
      beam(point(.48,-.19,1.97),point(.48,-.19,2.23),.007)
      segment(.33,.10,.028,.11,Math.PI*.95,.43,'metal')
      for(let i=0;i<3;i++)part(.35,.13+i*.035,.293,.012,.089,.006,'dark')
      if(hero){
        windows(.35,.306,.237,4)
        for(let j=0;j<3;j++)part(.35+(j-1)*.10,.304,.202,.006,.022,.026,j%2?'metal':'armor')
      }
    }else if(empire==='outerrim'){
      for(const side of [-1,1])beam(point(.18,.10,.9+side*.10),point(.45,.19,.9+side*.10),.006)
      beam(point(.45,.19,.8),point(.45,.19,1.0),.008)
      radiator(3.6,.19,-.23)
    }else{
      ring(.33,.007,.08,'accent');ring(.205,.006,-.146,'metal')
      for(let i=0;i<4;i++)part(i*Math.PI/2,.205,-.17,.095,.079,.058,'armor')
    }
  }
}
