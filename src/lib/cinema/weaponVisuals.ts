import { Vector3 } from 'three'
import type { CinemaCue } from './types'
import { resolveWeaponFamily, getWeaponColor } from './weapons'

export interface WeaponLine { from: Vector3; to: Vector3; width: number; color: number }
export interface WeaponGlow { position: Vector3; radius: number; color: number; opacity: number }
export interface WeaponRing { position: Vector3; radius: number; color: number; opacity: number }
export interface WeaponProjectile { position: Vector3; direction: Vector3; size: number; color: number }
export interface WeaponVisualFrame { lines: WeaponLine[]; glows: WeaponGlow[]; rings: WeaponRing[]; projectiles: WeaponProjectile[] }
const clamp = (value: number) => Math.max(0,Math.min(1,value))

/** Bounded, deterministic choreography. Misses use the caller's off-hull endpoint. */
export function weaponVisual(cue: CinemaCue, age: number, from: Vector3, to: Vector3, sourceSize: number, targetSize: number, reduced = false, collateralOrigin?: Vector3): WeaponVisualFrame {
  const frame: WeaponVisualFrame = {lines:[],glows:[],rings:[],projectiles:[]}
  const travel=Math.max(.015,cue.duration), impact=age-travel
  if(age<0 || impact>1.2)return frame
  const family=cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName,cue.damageType)
  const color=getWeaponColor(family,cue.damageType)
  const unit=Math.max(.35,Math.min(3,sourceSize*.012))
  const strength=cue.critical ? 1.3 : 1
  const direction=to.clone().sub(from), distance=direction.length()
  const side=new Vector3(-direction.z,0,direction.x).normalize()
  if(side.lengthSq()<.01)side.set(1,0,0)
  const glow=(position:Vector3,radius:number,opacity:number,tint=color)=>frame.glows.push({position:position.clone(),radius,color:tint,opacity:clamp(opacity)*(reduced?.55:1)})
  const line=(a:Vector3,b:Vector3,width:number,tint=color)=>frame.lines.push({from:a.clone(),to:b.clone(),width:width*strength,color:tint})
  const ring=(position:Vector3,radius:number,opacity:number,tint=color)=>frame.rings.push({position:position.clone(),radius,color:tint,opacity:clamp(opacity)*(reduced?.35:1)})
  const along=(progress:number)=>from.clone().lerp(to,clamp(progress))
  const arc=(progress:number,index:number,height:number)=>along(progress).addScaledVector(side,Math.sin(progress*Math.PI)*(index-1)*height*.65).add(new Vector3(0,Math.sin(progress*Math.PI)*height,0))

  if(cue.secondaryKind==='retaliation' || /galvanic hull grid/i.test(cue.weaponName ?? '')){
    // Contact defenses flare on the hull; they do not grow a ranged gun mount.
    if(cue.hit && impact>=0 && impact<.7){ring(from,sourceSize*(.3+impact*.3),(.7-impact)*.6,0xa0baff);glow(to,targetSize*.3,(.7-impact)*.4,0xa0baff)}
    return frame
  }
  if(cue.parentId){
    // Secondary rows are propagation from the first victim, never another gun.
    if(cue.hit && impact>=0 && impact<.75 && collateralOrigin){
      if(cue.secondaryKind==='chain'){
        let previous=collateralOrigin.clone()
        for(let j=1;j<=7;j++){
          const next=collateralOrigin.clone().lerp(to,j/7)
          if(j<7)next.y+=Math.sin(j*9+impact*30)*unit*4
          line(previous,next,unit*.3*(1-impact/.75),0xacbcff);previous=next
        }
      }else if(cue.secondaryKind==='aoe'||cue.secondaryKind==='ammo_splash'){
        ring(collateralOrigin,Math.max(targetSize*.5,collateralOrigin.distanceTo(to))*(.25+impact),(.7-impact)*.55)
      }
    }
    return frame
  }

  if(age<travel){
    const p=clamp(age/travel)
    if(family==='missile'||family==='torpedo'){
      const heavy=family==='torpedo', count=reduced||heavy?1:3
      for(let i=0;i<count;i++){
        const progress=clamp((p-i*.055)/(1-i*.055))
        if(p<i*.055)continue
        const flight=heavy?progress*progress:progress
        const height=Math.min(distance*.18,sourceSize*(heavy?.45:1.1))
        const head=arc(flight,i,height), tail=arc(Math.max(0,flight-.09),i,height)
        const tangent=head.clone().sub(tail)
        if(tangent.lengthSq()<.0001)tangent.copy(direction)
        frame.projectiles.push({position:head,direction:tangent.normalize(),size:unit*(heavy?2.6:1.2),color:0xb9c3cc})
        line(tail,head,unit*(heavy?.55:.22),0xffb05e)
        glow(head,unit*(heavy?7:4),.85,0xffbc72)
      }
    }else if(family==='railgun'){
      const fire=clamp((p-.5)*2)
      glow(from,sourceSize*.24*(1-p),.7,0xa0daff)
      if(p>=.5){line(along(Math.max(0,fire-.46)),along(fire),unit*.25,0xe1f5ff);line(from,along(fire),unit*.065,0x759dcc)}
    }else if(family==='autocannon'||family==='flak'||family==='kinetic'){
      const count=family==='kinetic'?1:reduced?2:5
      for(let i=0;i<count;i++){
        const head=clamp((p-i*.075)/(1-i*.075))
        if(p<i*.075)continue
        const a=along(Math.max(0,head-.095)),b=along(head)
        if(family==='flak'){const spread=(i-(count-1)/2)*targetSize*.1;a.addScaledVector(side,spread*head);b.addScaledVector(side,spread*head)}
        line(a,b,unit*(family==='flak'?.22:.17))
      }
      glow(from,unit*7,.5*(1-p))
    }else if(family==='plasma'){
      const head=along(p*p*(3-2*p)),tail=along(Math.max(0,p-.14))
      glow(head,unit*12,.8);glow(head,unit*3,.95,0xffeed1)
      line(tail,head,unit*.8)
    }else if(family==='mine'){
      // These records log deployed packets and attributed burn damage, not
      // persistent mine entities. Keep the charge inside this attack's life.
      const head=arc(p,1,sourceSize*.25)
      frame.projectiles.push({position:head,direction:direction.clone().normalize(),size:unit*2,color:0xc18248})
      glow(head,unit*(3+p*6),.35+p*.4)
      ring(head,unit*(3+p*5),.45)
    }else if(family==='smartbomb'){
      // Historical smartbombs apply target-centered area damage.
      const head=along(p)
      ring(head,unit*(3+p*6),.65)
      glow(head,unit*8,.6)
    }else if(family==='disruptor'){
      let previous=from.clone()
      for(let j=1;j<=9;j++){
        const next=along(j/9*p)
        if(j<9){next.y+=Math.sin(j*17+age*19)*unit*5;next.addScaledVector(side,Math.cos(j*7+age*15)*unit*5)}
        line(previous,next,unit*.24);previous=next
      }
      glow(along(p),unit*6,.55)
    }else if(family==='exotic'){
      const head=along(p)
      for(let strand=0;strand<(reduced?1:2);strand++){
        let previous=from.clone()
        for(let j=1;j<=12;j++){
          const t=j/12*p,phase=t*26-age*8+strand*Math.PI
          const next=along(t).addScaledVector(side,Math.sin(phase)*unit*4).add(new Vector3(0,Math.cos(phase)*unit*4,0))
          line(previous,next,unit*.18,strand?0xe6c8ff:color);previous=next
        }
      }
      ring(head,unit*(4+Math.sin(age*5)),.45)
    }else{
      const beam=family==='beam', pulse=reduced?1:.55+.45*Math.pow(Math.sin(age*(beam?7:24)),2)
      const head=along(p), tail=beam?from:along(Math.max(0,p-.32))
      line(tail,head,unit*(beam?.9:.36)*pulse)
      line(tail,head,unit*(beam?.22:.09),0xebfdff)
      glow(from,unit*(beam?10:5),.4*pulse)
    }
  }else if(cue.hit){
    const fade=1-impact/1.2
    if(family==='railgun'&&impact<.3)line(from,to,unit*.1*(1-impact/.3),0x94b7e9)
    if((cue.hullDamage ?? 0)>0 && ['missile','torpedo','plasma','smartbomb','mine','flak'].includes(family)){
      const scale=family==='torpedo'?1.1:family==='flak'?.4:.7
      glow(to,targetSize*scale*(.6+impact),fade*.5)
      if(!reduced)ring(to,targetSize*scale*(.2+impact*1.5),fade*.5)
    }
    if(family==='disruptor'||family==='exotic')ring(to,targetSize*(.3+impact*.6),fade*.6)
  }
  return frame
}
