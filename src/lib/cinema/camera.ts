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
  /** Target is a prize captured by the subject: keep it beside the victor. */
  prize?: boolean
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
  let mass: CameraBody | undefined, massAway: Vector3 | undefined
  // Establishing and closing shots frame the fleets whenever more than a pair is present.
  // A lone victor closes on itself with the field behind it instead.
  // A lone or dominant victor (a station or capital among escorts) closes on
  // itself with the field behind it instead of a fleet master.
  const allies = options.battlefield?.filter(body => body.side === subject.side) ?? []
  const loneVictor = role === 'resolution' && (allies.length <= 1 || subject.size >= 2.5 * [...allies].sort((a, b) => a.size - b.size)[allies.length >> 1].size)
  if ((shot.battlefield || role === 'geography' || role === 'resolution') && !loneVictor && !continuousTake && options.battlefield && options.battlefield.length > 2) {
    // Fleet master: from behind and above the subject's formation toward the
    // opposing one, so the near line fills the foreground and the enemy line
    // recedes into depth. Resolution masters rise over the whole field.
    // A long lens compresses depth, so the fleets stack up behind each other.
    const field = options.battlefield, fov = 28, vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect
    const own = field.filter(body => body.side === subject.side), rest = field.filter(body => body.side !== subject.side)
    const near = own.length && rest.length && role !== 'resolution' ? own : field
    const centroid = (bodies: readonly CameraBody[]) => bodies.reduce((sum, body) => sum.add(body.position), new Vector3()).divideScalar(bodies.length)
    const nearCenter = centroid(near), farCenter = near === field ? nearCenter.clone().add(axis) : centroid(rest)
    const toward = farCenter.clone().sub(nearCenter).setY(0)
    if (toward.lengthSq() < .001) toward.copy(axis)
    toward.normalize()
    const side = normal.clone().addScaledVector(toward, -normal.dot(toward)).normalize()
    if (side.lengthSq() < .001) side.set(-toward.z, 0, toward.x)
    const base = near === field ? bearing(side, toward.clone().negate(), 25, .34) : bearing(toward.clone().negate(), side, 38, .34)
    focus.copy(near === field ? nearCenter : nearCenter.clone().lerp(farCenter, .3))
    const spheres = near.map(body => ({ position: body.position, radius: framingRadius(body) }))
    const others = near === field ? [] : rest.map(body => ({ position: body.position, radius: 0 }))
    // Far-flung stragglers may leave the frame rather than shrink the formation.
    const fleetDistance = (viewing: Vector3) => Math.min(fitDistance(viewing, vertical * .92, horizontal * .92, focus, spheres) * 2,
      fitDistance(viewing, vertical * .92, horizontal * .92, focus, [...spheres, ...others]))
    // A mass too large to read as hulls: frame the principal of the larger
    // fleet from the enemy's side, with its mass stretching away behind it.
    // Decided on the unmoved master, so the choice cannot flip mid-shot.
    const principal = target && target.size < subject.size ? target : subject
    const reference = focus.clone().addScaledVector(base, fleetDistance(base))
    if (!target || role === 'resolution' || principal.size / (2 * horizontal * Math.max(1, reference.distanceTo(principal.position))) >= .02) {
      const viewing = base.clone().applyAxisAngle(UP, reduced ? 0 : (progress - .5) * .18)
      position.copy(viewing).multiplyScalar(fleetDistance(viewing) * (role === 'resolution' ? 1 + progress * .15 : 1.04 - progress * .08)).add(focus)
      return { position, target: focus, fov }
    }
    const count = (body: CameraBody) => field.filter(other => other.side === body.side).length
    mass = count(target) > count(subject) ? target : subject
    massAway = mass.position.clone().sub(centroid(field.filter(body => body.side === mass!.side))).setY(0)
    if (massAway.lengthSq() < .001) massAway = undefined
    focus.copy(subject.position)
  }
  // A hull that dies during this shot is the victim: it becomes the framed hull.
  const victim = options.dying ? [subject, target].find(body => body?.id === options.dying) : undefined
  // `near` is the hull the camera is built around, `far` its counterpart.
  let near = mass ?? victim ?? subject
  let far = near === subject ? target : subject
  // Scale shot: in a pair establishing shot the smaller hull takes the
  // foreground so it reads, and the larger one fills the background.
  // Boarding always shoulders the smaller hull, whose contact site is the story.
  if (!mass && !victim && role === 'geography' && far && framingRadius(near) > framingRadius(far) * (continuousTake ? 1 : 2.2)) [near, far] = [far, near]
  const toward = far ? far.position.clone().sub(near.position).setY(0) : axis.clone()
  if (toward.lengthSq() < .001) toward.copy(axis)
  toward.normalize()
  const away = toward.clone().negate()
  // Camera side of the line: the component of the axis normal across this pair.
  const side = normal.clone().addScaledVector(toward, -normal.dot(toward)).normalize()
  if (side.lengthSq() < .001) side.set(-toward.z, 0, toward.x)
  const variant = options.variant ?? { angle: 0, lift: 0, distance: 1 }
  const swing = (viewing: Vector3, arc: number) => {
    viewing.applyAxisAngle(UP, variant.angle + (reduced ? 0 : (progress - .5) * arc * Math.PI / 180))
    viewing.y += variant.lift
    return viewing.normalize()
  }
  // Over-the-shoulder coverage: camera just behind `front`, which fills a
  // shoulder of the frame, looking downrange at `back`, which stays whole.
  // The distance is chosen so `back` reads at about 7% of the frame width
  // whenever sizes and separation allow it (telephoto compression), rather
  // than fitting both hulls whole and shrinking `back` to a speck.
  const overShoulder = (front: CameraBody, back: CameraBody, degrees: number, lift: number, dolly: number) => {
    const line = back.position.clone().sub(front.position).setY(0)
    if (line.lengthSq() < .001) line.copy(toward)
    line.normalize()
    const lateral = side.clone().addScaledVector(line, -side.dot(line)).normalize()
    const separation = Math.max(1, front.position.distanceTo(back.position))
    const ratio = .42 / .07 * back.size / front.size
    let distance = Math.max(framingRadius(front) * 1.5, ratio > 1.05 ? separation / (ratio - 1) : 0) * variant.distance * dolly
    // Offset just enough to clear the front hull from the sightline, so a long
    // lens can hold both: a fixed angle would force a wide lens at range.
    const clear = Math.asin(Math.min(1, 1.7 * framingRadius(front) / distance)) * 180 / Math.PI
    const viewing = swing(bearing(line.clone().negate(), lateral.lengthSq() > .001 ? lateral : side, Math.max(4, Math.min(degrees, clear)), lift), 5)
    position.copy(front.position).addScaledVector(viewing, distance)
    let horizontal = Math.min(front.size / (2 * .42 * distance), Math.tan(28 * Math.PI / 180) * aspect)
    const backCorners = hullCorners(back)
    // Widen the lens until both read (refined continuously, so moving hulls
    // never step the lens); past 56 degrees, back away instead.
    const aim = (h: number) => {
      focus.copy(position).addScaledVector(front.position.clone().sub(position).normalize().multiplyScalar(.45)
        .addScaledVector(back.position.clone().sub(position).normalize(), .55).normalize(), distance)
      return inFrame(position, focus, h / aspect, h, backCorners, .88) && inFrame(position, focus, h / aspect, h, [front.position], .8)
    }
    const widest = Math.tan(28 * Math.PI / 180) * aspect
    const at = (value: number) => { distance = value; position.copy(front.position).addScaledVector(viewing, distance); return aim(widest) }
    if (!at(distance)) {
      let lower = distance, upper = distance * 5.4
      if (at(upper)) for (let refinement = 0; refinement < 16; refinement++) { const middle = (lower + upper) / 2; if (at(middle)) upper = middle; else lower = middle }
      at(upper)
    }
    if (!aim(horizontal)) {
      let lower = horizontal, upper = widest
      for (let refinement = 0; refinement < 16; refinement++) { const middle = (lower + upper) / 2; if (aim(middle)) upper = middle; else lower = middle }
      horizontal = upper; aim(horizontal)
    }
    const vertical = Math.max(Math.tan(2.5 * Math.PI / 180), horizontal / aspect)
    return { position, target: focus, fov: Math.atan(vertical) * 360 / Math.PI }
  }
  // The camera sits behind the smaller hull of a very uneven pair: a capital
  // cannot shoulder a fighter at readable size, but it fills the far frame.
  const exchange = (from: CameraBody, to: CameraBody, dolly: number) =>
    from.size > to.size * 6 ? overShoulder(to, from, 20, .08, dolly) : overShoulder(from, to, 16, .07, dolly)
  // Single or two-shot: `near` spans `share` of the frame width (whole), and
  // `far` is whole ('full'), center-only within a bounded pullback ('loose')
  // or ignored ('none'). The distance is refined continuously.
  const framed = (fov: number, viewing: Vector3, share: number, include: 'full' | 'loose' | 'none', weight: number, dolly: number, pullback = 2) => {
    const counterpart = include === 'none' ? undefined : far
    const vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect
    const nearCorners = hullCorners(near), farCorners = counterpart ? hullCorners(counterpart) : []
    const lookAt = new Vector3(), toNear = new Vector3(), toFar = new Vector3()
    let requireLoose = include === 'loose'
    const place = (distance: number) => {
      position.copy(near.position).addScaledVector(viewing, distance)
      toNear.copy(near.position).sub(position).normalize()
      if (counterpart && (requireLoose || include === 'full')) toFar.copy(counterpart.position).sub(position).normalize()
      else toFar.copy(toNear).addScaledVector(toward, .12).normalize()
      lookAt.copy(toNear).multiplyScalar(weight).addScaledVector(toFar, 1 - weight).normalize()
      focus.copy(position).addScaledVector(lookAt, near.position.distanceTo(position))
    }
    const fits = (distance: number) => {
      place(distance)
      return inFrame(position, focus, vertical, horizontal, nearCorners, .86) &&
        (include !== 'full' || inFrame(position, focus, vertical, horizontal, farCorners, .92)) &&
        (!requireLoose || inFrame(position, focus, vertical, horizontal, [counterpart!.position], .85))
    }
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
    // A loose counterpart costs a bounded pullback, then may leave the frame.
    let distance = counterpart ? fit(opening, include === 'loose' ? opening * pullback : Infinity) : undefined
    if (distance === undefined) { requireLoose = false; distance = fit(opening) ?? opening }
    place(distance * dolly)
    return { position, target: focus, fov }
  }
  // Montage alternates the exchange and the hit hull by shot start.
  const alternate = Math.floor(shot.start * 7) % 2 === 0
  if (mass) {
    // Long lens from the open side of the principal: its fleet compresses behind it.
    return framed(14, swing(bearing(massAway?.normalize() ?? toward, side, 12, .02), 4), .22, 'none', .85, 1)
  }
  if (continuousTake) {
    // Boarding: one continuous take over the smaller hull's shoulder onto its
    // counterpart, following the live docking line through contact.
    return framed(36, swing(bearing(away, side, 42, .22), 0), .34, 'loose', .6, 1 - progress * .05, 1.5)
  }
  if (victim) {
    // Medium on the victim from its front quarter, room for the fireball.
    return framed(28, swing(bearing(toward, side, 62, .14), 6), .28, 'none', 1, 1 + progress * .2)
  }
  if (far && (role === 'fire' || (role === 'montage' && alternate))) return exchange(near, far, 1 - progress * .08)
  // Reverse: over the receiving hull's shoulder back toward its attacker.
  if (far && role === 'reaction') return exchange(near, far, 1 - progress * .06)
  if (role === 'impact' || role === 'montage') {
    // The hit hull at medium size from its front quarter, incoming fire from behind camera.
    return framed(26, swing(bearing(toward, side, 58, .12), 5), .36, 'none', 1, 1 - progress * .1)
  }
  if (role === 'setup') {
    // Low three-quarter from ahead of the shooter, arcing toward its line of fire.
    return framed(30, swing(bearing(toward, side, 52, .05), 12), .46, 'none', .8, 1)
  }
  if ((role as string) === 'introduction') {
    // A slow pass along the hull, close enough to read its painted name.
    return framed(26, swing(bearing(side, toward, 12, .06), -16), .8, 'none', .9, 1 - progress * .05)
  }
  if ((role as string) === 'arrival') return framed(34, swing(bearing(toward, side, 42, .14), 0), .32, 'none', .8, 1 + progress * .1)
  if (role === 'protagonist' || role === 'opposition') return framed(30, swing(bearing(side, toward, 48, .16), -9), .45, 'none', .82, 1 - progress * .07)
  if (role === 'resolution') {
    // The victor from its rear quarter, pulling away; a captured prize stays in frame.
    return framed(loneVictor ? 20 : 32, swing(bearing(side, away, 35, loneVictor ? .12 : .26), 10), .24, options.prize ? 'full' : 'none', .7, 1 + progress * .3)
  }
  // Geography between a pair: side-on two-shot with both hulls whole, or a
  // scale shot from behind the small foreground hull onto a capital.
  // A widely separated pair: a long-lens shoulder shot from the smaller hull.
  if (far && near.position.distanceTo(far.position) > 6 * (near.size + far.size)) return overShoulder(near, far, 28, .14, 1 - progress * .06)
  if (far && framingRadius(far) > framingRadius(near) * 2.2) return framed(40, swing(bearing(away, side, 30, .2), 8), .22, 'full', .5, 1 - progress * .06)
  return framed(30, swing(bearing(side, away, 12, .22), 8), .2, far ? 'full' : 'none', .5, 1 - progress * .06)
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
