import { Vector3, Quaternion, Euler } from 'three'
import type { CinemaShot, CinemaSequence } from './types'
export interface HullBoundary { position: Vector3; radius: number }
/** A later projection must not put the camera back inside an earlier hull. */
export function keepCameraOutsideHulls(position: Vector3, hulls: readonly HullBoundary[]): void {
  const offset = new Vector3()
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const hull of hulls) {
      offset.copy(position).sub(hull.position)
      if (offset.lengthSq() >= hull.radius * hull.radius) continue
      if (offset.lengthSq() < 0.00001) offset.set(0, 1, 0)
      position.copy(hull.position).add(offset.normalize().multiplyScalar(hull.radius + 0.01))
      changed = true
    }
    if (!changed) return
  }
  if (hulls.some(hull => position.distanceToSquared(hull.position) < hull.radius * hull.radius)) {
    position.y = hulls.reduce((height, hull) => Math.max(height, hull.position.y + hull.radius + 1), position.y)
  }
}

export interface CameraBody { id: string; position: Vector3; size: number
  /** Battle side, for fleet masters. */
  side?: number
  /** World-sized model-space hull bounds, before rotation. */
  contactHull?: { min: Vector3; max: Vector3; yaw: number; bank: number }
}
function hullRotation(body: CameraBody): Quaternion {
  return new Quaternion().setFromEuler(new Euler(body.contactHull!.bank, body.contactHull!.yaw, 0, 'YXZ'))
}
/** Conservative physical clearance without treating empty space beside a capital as hull. */
export function keepCameraOutsideBodies(position: Vector3, bodies: readonly CameraBody[]): void {
  const inside = (body: CameraBody, project: boolean) => {
    if (!body.contactHull) {
      const offset=position.clone().sub(body.position), radius=body.size*.78
      if(offset.lengthSq()>=radius*radius)return false
      if(project){if(offset.lengthSq()<.00001)offset.set(0,1,0);position.copy(body.position).add(offset.normalize().multiplyScalar(radius+.01))}
      return true
    }
    const rotation=hullRotation(body), local=position.clone().sub(body.position).applyQuaternion(rotation.clone().invert())
    const min=body.contactHull.min.clone().addScalar(-1), max=body.contactHull.max.clone().addScalar(1)
    if(local.x<min.x||local.x>max.x||local.y<min.y||local.y>max.y||local.z<min.z||local.z>max.z)return false
    if(project){
      let best=Infinity, component:'x'|'y'|'z'='y', value=max.y
      for(const key of ['x','y','z'] as const)for(const face of [min[key]-.01,max[key]+.01]){
        const distance=Math.abs(local[key]-face)
        if(distance<best){best=distance;component=key;value=face}
      }
      local[component]=value;position.copy(local.applyQuaternion(rotation).add(body.position))
    }
    return true
  }
  for(let pass=0;pass<4;pass++){let changed=false;for(const body of bodies)changed=inside(body,true)||changed;if(!changed)return}
  if(bodies.some(body=>inside(body,false)))position.y=bodies.reduce((height,body)=>Math.max(height,body.position.y+(body.contactHull?Math.max(body.contactHull.min.length(),body.contactHull.max.length()):body.size*.78)+2),position.y)
}
/** Furthest positive intersection on the proposed dolly ray. */
function contactRayExit(body: CameraBody, origin: Vector3, direction: Vector3): number {
  if(body.contactHull){
    const inverse=hullRotation(body).invert(), p=origin.clone().sub(body.position).applyQuaternion(inverse), d=direction.clone().applyQuaternion(inverse)
    let entry=-Infinity, exit=Infinity
    for(const key of ['x','y','z'] as const){
      const min=body.contactHull.min[key]-1,max=body.contactHull.max[key]+1
      if(Math.abs(d[key])<1e-8){if(p[key]<min||p[key]>max)return 0;continue}
      const a=(min-p[key])/d[key],b=(max-p[key])/d[key]
      entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b))
    }
    return entry<=exit&&exit>0?exit+.01:0
  }
  const relative=body.position.clone().sub(origin),along=relative.dot(direction),radius=body.size*.78+1
  const perpendicular=relative.lengthSq()-along*along
  return perpendicular<radius*radius?Math.max(0,along+Math.sqrt(radius*radius-perpendicular)):0
}
export interface StoryCameraFrame { position: Vector3; target: Vector3; fov: number }
export interface StoryCameraOptions {
  shot: CinemaShot
  sequence?: CinemaSequence
  time: number
  aspect: number
  subject: CameraBody
  target?: CameraBody
  /** Active battlefield bodies; only strategic masters use the full envelope. */
  battlefield?: readonly CameraBody[]
  /** Reference positions sampled once at the sequence's opening. */
  axisFrom: Vector3
  axisTo: Vector3
  /** Hold broadside coverage for a take containing a recorded boarding action. */
  boarding?: boolean
  reduced?: boolean
  /** Subject or target that dies or is knocked out during this shot. */
  dying?: string
  /** Planner candidate: bearing rotation (radians), extra lift and distance scale. */
  variant?: { angle: number; lift: number; distance: number }
}
const ease = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p) }
const UP = new Vector3(0, 1, 0)
/** Framing radius: the real rotated hull bounds when known, else a conservative hull box. */
export function framingRadius(body: CameraBody): number {
  return body.contactHull ? Math.max(body.contactHull.min.length(), body.contactHull.max.length()) : body.size * .78
}
/** World-space corners of the hull bounds (or a conservative hull box). */
export function hullCorners(body: CameraBody): Vector3[] {
  const bounds = body.contactHull
  const rotation = bounds ? new Quaternion().setFromEuler(new Euler(bounds.bank, bounds.yaw, 0, 'YXZ')) : new Quaternion()
  const min = bounds?.min ?? new Vector3(-body.size * .5, -body.size * .2, -body.size * .3)
  const max = bounds?.max ?? min.clone().negate()
  const result: Vector3[] = []
  for (const x of [min.x,max.x]) for (const y of [min.y,max.y]) for (const z of [min.z,max.z]) result.push(new Vector3(x,y,z).applyQuaternion(rotation).add(body.position))
  return result
}
/** Every point projects inside `margin` of the frame edges and in front of the camera. */
function inFrame(position: Vector3, target: Vector3, vertical: number, horizontal: number, points: readonly Vector3[], margin: number): boolean {
  const forward = target.clone().sub(position).normalize(), right = new Vector3().crossVectors(forward, UP).normalize(), up = new Vector3().crossVectors(right, forward), relative = new Vector3()
  return points.every(point => {
    relative.copy(point).sub(position)
    const depth = relative.dot(forward)
    return depth > .5 && Math.abs(relative.dot(right)) < depth * horizontal * margin && Math.abs(relative.dot(up)) < depth * vertical * margin
  })
}
/** Camera distance along `viewing` that keeps every sphere inside the frustum around `focus`. */
function fitDistance(viewing: Vector3, vertical: number, horizontal: number, focus: Vector3, spheres: readonly { position: Vector3; radius: number }[]): number {
  const forward = viewing.clone().negate(), right = new Vector3().crossVectors(forward, UP).normalize(), up = new Vector3().crossVectors(right, forward)
  const sinHorizontal = Math.sin(Math.atan(horizontal)), sinVertical = Math.sin(Math.atan(vertical)), relative = new Vector3()
  let distance = 1
  for (const sphere of spheres) {
    relative.copy(sphere.position).sub(focus)
    const depth = relative.dot(forward)
    distance = Math.max(distance, sphere.radius + 1 - depth,
      Math.abs(relative.dot(right)) / horizontal + sphere.radius / sinHorizontal - depth,
      Math.abs(relative.dot(up)) / vertical + sphere.radius / sinVertical - depth)
  }
  return distance
}
/** Horizontal view direction rotated from `from` toward `to` by `degrees`, then lifted. */
function bearing(from: Vector3, to: Vector3, degrees: number, lift: number): Vector3 {
  const angle = degrees * Math.PI / 180
  return from.clone().multiplyScalar(Math.cos(angle)).addScaledVector(to, Math.sin(angle)).setY(0).normalize().add(new Vector3(0, lift, 0)).normalize()
}

/**
 * Authored coverage stays on one side of the line (the axis normal). Each role
 * has its own lens, bearing and move; distances are fitted continuously so the
 * framed hulls stay whole while ships move. Absolute time makes seeking exact.
 */
export function sampleStoryCamera(options: StoryCameraOptions): StoryCameraFrame {
  const { shot, sequence, time, reduced } = options
  let { subject, target } = options
  // Boarding keeps one continuous take around the recorded contact.
  const continuousTake = !!options.boarding && !shot.battlefield && sequence && sequence.id === shot.sequenceId && target &&
    ((subject.id === sequence.attacker && target.id === sequence.defender) ||
      (target.id === sequence.attacker && subject.id === sequence.defender))
  if (continuousTake && subject.id !== sequence?.attacker) [subject, target] = [target!, subject]
  const aspect = Math.max(.2, options.aspect)
  const start = continuousTake ? sequence!.start : shot.start
  const end = continuousTake ? sequence!.end : shot.end
  const progress = reduced ? 0 : ease((time - start) / Math.max(.01, end - start))
  const axis = options.axisTo.clone().sub(options.axisFrom); axis.y = 0
  if (axis.lengthSq() < .001) axis.set(1,0,0)
  axis.normalize()
  const normal = new Vector3(-axis.z,0,axis.x).multiplyScalar(shot.axis?.side ?? 1)
  if (continuousTake && target) {
    // Follow the actual docking line as the boarder rounds its target. Anchor
    // handedness to actor identity, not a dot-product sign that flips at 90deg.
    const liveAxis = target.position.clone().sub(subject.position); liveAxis.y = 0
    if (liveAxis.lengthSq() > .001) {
      liveAxis.normalize()
      const canonicalFrom = shot.axis?.from ?? sequence?.axis?.from ?? sequence?.attacker
      const handedness = canonicalFrom === sequence?.attacker ? 1 : -1
      normal.set(-liveAxis.z, 0, liveAxis.x).multiplyScalar(handedness * (shot.axis?.side ?? 1))
    }
  }
  const authoredRole = shot.role ?? (shot.kind === 'reveal' ? 'geography' : shot.kind === 'aftermath' ? 'resolution' : 'reaction')
  const role = continuousTake ? 'geography' : authoredRole
  const focus = subject.position.clone()
  const position = new Vector3()
  // Establishing and closing shots frame the fleets whenever more than a pair is present.
  if ((shot.battlefield || role === 'geography' || role === 'resolution') && !continuousTake && options.battlefield && options.battlefield.length > 2) {
    // Fleet master: from behind and above the subject's formation toward the
    // opposing one, so the near line fills the foreground and the enemy line
    // recedes into depth. Resolution masters rise over the whole field.
    const field = options.battlefield, fov = 40, vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect
    const own = field.filter(body => body.side === subject.side), rest = field.filter(body => body.side !== subject.side)
    const near = own.length && rest.length && role !== 'resolution' ? own : field
    const centroid = (bodies: readonly CameraBody[]) => bodies.reduce((sum, body) => sum.add(body.position), new Vector3()).divideScalar(bodies.length)
    const nearCenter = centroid(near), farCenter = near === field ? nearCenter.clone().add(axis) : centroid(rest)
    const toward = farCenter.clone().sub(nearCenter).setY(0)
    if (toward.lengthSq() < .001) toward.copy(axis)
    toward.normalize()
    const side = normal.clone().addScaledVector(toward, -normal.dot(toward)).normalize()
    if (side.lengthSq() < .001) side.set(-toward.z, 0, toward.x)
    const viewing = near === field ? bearing(side, toward.clone().negate(), 15, .5) : bearing(toward.clone().negate(), side, 38, .34)
    if (!reduced) viewing.applyAxisAngle(UP, (progress - .5) * .18)
    focus.copy(near === field ? nearCenter : nearCenter.clone().lerp(farCenter, .3))
    const spheres = near.map(body => ({ position: body.position, radius: framingRadius(body) }))
    const nearDistance = fitDistance(viewing, vertical * .92, horizontal * .92, focus, spheres)
    // Far-flung stragglers may leave the frame rather than shrink the formation.
    const distance = Math.min(nearDistance * 2, fitDistance(viewing, vertical * .92, horizontal * .92, focus,
      [...spheres, ...(near === field ? [] : rest.map(body => ({ position: body.position, radius: 0 })))]))
    position.copy(viewing).multiplyScalar(distance * (role === 'resolution' ? 1 + progress * .15 : 1.04 - progress * .08)).add(focus)
    return { position, target: focus, fov }
  }
  if (continuousTake && target) {
    // Boarding master: establish both hulls, then close on the small hull's contact site.
    const fov = 42, vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect
    focus.lerp(target.position,.5)
    const radius = Math.max(focus.distanceTo(subject.position)+subject.size*.72,focus.distanceTo(target.position)+target.size*.72)
    const distance = radius / Math.sin(Math.atan(Math.min(vertical,horizontal))) * (1.18 - progress*.12)
    position.copy(focus).addScaledVector(normal,distance*.95)
    position.y += distance*.31
    if (Math.max(subject.size, target.size) > Math.min(subject.size, target.size) * 3) {
      // Once the capital is established, show the small hull and its contact
      // site. Fitting the entire capital would reduce this vessel to a dot.
      const small = subject.size < target.size ? subject : target
      const large = small === subject ? target : subject
      const outward = small.position.clone().sub(large.position).normalize()
      if (outward.lengthSq() < .001) outward.copy(axis)
      const contactFocus = small.position.clone().addScaledVector(outward, -small.size * .35)
      const viewing = normal.clone().addScaledVector(outward, .4).add(new Vector3(0, .32, 0)).normalize()
      const approach = reduced ? 1 : ease(progress * 2)
      const wideDistance = position.distanceTo(focus)
      const closeDistance = Math.max(small.size * 3.2, small.size * .85 / horizontal, 24)
      focus.lerp(contactFocus, approach)
      let contactDistance = wideDistance + (closeDistance - wideDistance) * approach
      // A camera dolly follows this outward ray, with an analytic bound for
      // both complete hulls. Cropping a capital never permits entering it.
      for (const body of [subject, target]) contactDistance = Math.max(contactDistance, contactRayExit(body, focus, viewing))
      position.copy(focus).addScaledVector(viewing, contactDistance)
    }
    return { position, target: focus, fov }
  }
  // A hull that dies during this shot is the victim: it becomes the framed primary.
  const victim = options.dying && [subject, target].find(body => body?.id === options.dying)
  let near = victim || subject
  let far = near === subject ? target : subject
  // Scale contrast: the smaller hull takes the foreground so it reads, while a
  // capital fills the background (fighter against a star destroyer).
  const swapped = !victim && role !== 'resolution' && !!far && framingRadius(near) > framingRadius(far) * (role === 'geography' ? 1 : 2.2)
  if (swapped) [near, far] = [far!, near]
  const toward = far ? far.position.clone().sub(near.position).setY(0) : axis.clone()
  if (toward.lengthSq() < .001) toward.copy(axis)
  toward.normalize()
  const away = toward.clone().negate()
  // Camera side of the line: the component of the axis normal across this pair.
  const side = normal.clone().addScaledVector(toward, -normal.dot(toward)).normalize()
  if (side.lengthSq() < .001) side.set(-toward.z, 0, toward.x)
  const variant = options.variant ?? { angle: 0, lift: 0, distance: 1 }
  // Lens (fov), bearing, foreground share (hull length over frame width), aim
  // weight toward the foreground hull, counterpart inclusion, dolly and arc.
  let fov: number, viewing: Vector3, share: number, weight = .5, include: 'full' | 'loose' | 'none' = 'loose', dolly = 1, arc = 0
  if (victim) {
    // Room for the fireball; the killer sits beyond the victim.
    fov = 30; viewing = bearing(away, side, 30, .16); share = .14; weight = .72; dolly = 1 + progress * .2; arc = 6
  } else if (role === 'fire') {
    // Long-lens over-the-shoulder: foreground hull, counterpart downrange.
    fov = 26; viewing = bearing(away, side, 20, .1); share = .3; weight = .45; include = 'full'; dolly = 1 - progress * .07
  } else if (role === 'setup') {
    fov = 34; viewing = bearing(away, side, 28, .18); share = .3; weight = .55; include = 'full'; arc = 7
  } else if (role === 'impact' || role === 'reaction') {
    fov = 26; viewing = bearing(away, side, 22, .12); share = .34; dolly = 1 - progress * .09
  } else if (role === 'protagonist' || role === 'opposition') {
    // Hero three-quarter from ahead of the bow, slowly arcing.
    fov = 30; viewing = bearing(side, toward, 48, .16); share = .45; weight = .82; include = 'none'; arc = -9; dolly = 1 - progress * .07
  } else if (role === 'montage') {
    fov = 34; viewing = bearing(side, away, 42, .22); share = .3; arc = 12
  } else if (role === 'resolution') {
    fov = 34; viewing = bearing(side, away, 18, .3); share = .22; weight = .7; dolly = 1 + progress * .35; arc = 10
  } else {
    // Geography between a pair: from behind the foreground hull toward the other.
    fov = 38; viewing = bearing(away, side, 30, .24); share = .22; include = 'full'; arc = 8; dolly = 1 - progress * .06
  }
  if (!far) include = 'none'
  // A capital behind a small foreground hull needs a wider lens to stay whole.
  if (swapped) fov = Math.max(fov, 40)
  viewing.applyAxisAngle(UP, variant.angle + (reduced ? 0 : (progress - .5) * arc * Math.PI / 180))
  viewing.y += variant.lift; viewing.normalize()
  const vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect
  const nearCorners = hullCorners(near), farCorners = far ? hullCorners(far) : []
  const lookAt = new Vector3(), toNear = new Vector3(), toFar = new Vector3()
  const place = (distance: number) => {
    position.copy(near.position).addScaledVector(viewing, distance)
    toNear.copy(near.position).sub(position).normalize()
    if (far && include !== 'none') toFar.copy(far.position).sub(position).normalize()
    else toFar.copy(toNear).addScaledVector(toward, .12).normalize()
    lookAt.copy(toNear).multiplyScalar(weight).addScaledVector(toFar, 1 - weight).normalize()
    focus.copy(position).addScaledVector(lookAt, near.position.distanceTo(position))
  }
  const fits = (distance: number) => {
    place(distance)
    return inFrame(position, focus, vertical, horizontal, nearCorners, .86) &&
      (include !== 'full' || inFrame(position, focus, vertical, horizontal, farCorners, .96)) &&
      (include !== 'loose' || inFrame(position, focus, vertical, horizontal, [far!.position], .85))
  }
  // Start at the foreground share, back off until the frame holds, then refine
  // continuously so moving hulls never step between discrete distances.
  const fit = (start: number, limit = Infinity) => {
    let distance = start
    if (fits(distance)) return distance
    let lower = distance
    for (let attempt = 0; attempt < 30 && distance < limit && !fits(distance = Math.min(limit, distance * 1.25)); attempt++) lower = distance
    if (!fits(distance)) return undefined
    let upper = distance
    for (let refinement = 0; refinement < 18; refinement++) { const middle = (lower + upper) / 2; if (fits(middle)) upper = middle; else lower = middle }
    return upper
  }
  const opening = near.size / (2 * horizontal * share) * variant.distance
  // A loose counterpart may cost at most a 2.5x pullback; beyond that the
  // foreground hull keeps its size and the counterpart leaves the frame.
  let distance = include === 'loose' ? fit(opening, opening * 2.5) : fit(opening)
  if (distance === undefined) { include = 'none'; distance = fit(opening) ?? opening }
  place(distance * dolly)
  return { position, target: focus, fov }
}

/** Move only upward to clear foreground hulls, never across the engagement axis. */
export function clearStorySightline(frame: StoryCameraFrame, focusId: string, bodies: readonly CameraBody[]): void {
  const direction = new Vector3(), offset = new Vector3(), closest = new Vector3()
  const occluded = () => {
    direction.copy(frame.target).sub(frame.position)
    const lengthSq = direction.lengthSq()
    return bodies.some(body => {
      if (body.id === focusId) return false
      const t = offset.copy(body.position).sub(frame.position).dot(direction) / Math.max(1,lengthSq)
      if (t <= .02 || t >= .96) return false
      closest.copy(frame.position).addScaledVector(direction,t)
      return closest.distanceToSquared(body.position) < Math.pow(body.size*.52,2)
    })
  }
  const step = Math.max(25,frame.position.distanceTo(frame.target)*.12)
  for(let attempt=0; attempt<5 && occluded(); attempt++) frame.position.y += step
  keepCameraOutsideBodies(frame.position,bodies)
}
