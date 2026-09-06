import { Vector3 } from 'three'
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

export interface CameraBody { id: string; position: Vector3; size: number }
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
  reduced?: boolean
}
const ease = (value: number) => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p) }

/** Authored coverage stays on one side of the line, independent of hull heading. */
export function sampleStoryCamera(options: StoryCameraOptions): StoryCameraFrame {
  const { shot, sequence, subject, target, time, reduced } = options
  const aspect = Math.max(.2, options.aspect)
  const progress = reduced ? 0 : ease((time - shot.start) / Math.max(.01, shot.end - shot.start))
  const axis = options.axisTo.clone().sub(options.axisFrom); axis.y = 0
  if (axis.lengthSq() < .001) axis.set(1,0,0)
  axis.normalize()
  const normal = new Vector3(-axis.z,0,axis.x).multiplyScalar(shot.axis?.side ?? 1)
  const authoredRole = shot.role ?? (shot.kind === 'reveal' ? 'geography' : shot.kind === 'aftermath' ? 'resolution' : 'reaction')
  const role = reduced && authoredRole !== 'fire' && authoredRole !== 'setup' ? 'geography' : authoredRole
  const focus = subject.position.clone()
  const position = new Vector3()
  const fov = ['geography','setup','fire','montage'].includes(role) ? 42 : 34
  const vertical = Math.tan(fov * Math.PI / 360), horizontal = vertical * aspect
  const wide = role === 'geography' || role === 'montage'
  if (shot.battlefield && options.battlefield?.length) {
    // Fit the occupied volume, not the arithmetic fleet center: one capital
    // versus a hundred dispersed fighters still needs both outer boundaries.
    const lower = new Vector3(Infinity, Infinity, Infinity), upper = new Vector3(-Infinity, -Infinity, -Infinity)
    for (const body of options.battlefield) {
      const radius = body.size * .78
      lower.min(body.position.clone().addScalar(-radius))
      upper.max(body.position.clone().addScalar(radius))
    }
    focus.copy(lower).add(upper).multiplyScalar(.5)
    // The formation has depth as well as width. An elevated three-quarter
    // direction exposes that depth rather than stacking every row edge-on.
    const viewing = normal.clone().multiplyScalar(.7).addScaledVector(axis, .6).add(new Vector3(0, .65, 0)).normalize()
    const forward = viewing.clone().negate(), right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
    const cameraUp = new Vector3().crossVectors(right, forward).normalize(), relative = new Vector3()
    const sinHorizontal = Math.sin(Math.atan(horizontal)), sinVertical = Math.sin(Math.atan(vertical))
    let distance = 1
    for (const body of options.battlefield) {
      relative.copy(body.position).sub(focus)
      const radius = body.size * .78, depth = relative.dot(forward)
      // Sphere distance from each frustum plane, including its actual depth.
      // One global bounding sphere wastes most of an ultrawide viewport.
      distance = Math.max(distance, radius + 1 - depth,
        Math.abs(relative.dot(right)) / horizontal + radius / sinHorizontal - depth,
        Math.abs(relative.dot(cameraUp)) / vertical + radius / sinVertical - depth)
    }
    position.copy(viewing).multiplyScalar(distance * (1.10 - progress * .04)).add(focus)
  } else if ((role === 'setup' || role === 'fire') && target) {
    // Follow the shot downrange from the attacker's shoulder. A firing angle
    // must not face the muzzle or leave the target outside a side-on closeup.
    const toward = target.position.clone().sub(subject.position)
    const separation = toward.length()
    if (separation < .001) toward.copy(axis)
    else toward.multiplyScalar(1 / separation)
    const shoulder = normal.clone().addScaledVector(toward, -normal.dot(toward)).normalize()
    if (shoulder.lengthSq() < .001) shoulder.set(-toward.z, 0, toward.x).normalize()
    const size = subject.size
    const lift = new Vector3().crossVectors(shoulder, toward).normalize()
    if (lift.y < 0) lift.negate()
    const transverse = shoulder.clone().multiplyScalar(.8).addScaledVector(lift, .5).normalize()
    // Keep the ray to the target beyond the foreground hull, even when a
    // portrait fit moves the camera much farther back. A fixed shoulder offset
    // collapses the two silhouettes together as the pullback grows.
    const clearance = Math.min(size * .88, separation * .85)
    const tangent = Math.sqrt(Math.max(.001, separation * separation - clearance * clearance))
    let distance = size * 2.5 * Math.max(1, 1 / aspect)
    focus.addScaledVector(toward, Math.min(separation * .46, size * .8))
    const forward = new Vector3(), right = new Vector3(), cameraUp = new Vector3(), relative = new Vector3()
    for (let attempt = 0; attempt < 24; attempt++) {
      const offset = Math.max(size * Math.hypot(.8, .5), clearance * (distance + separation) / tangent)
      position.copy(subject.position).addScaledVector(toward, -distance).addScaledVector(transverse, offset)
      forward.copy(focus).sub(position).normalize()
      right.crossVectors(forward, new Vector3(0, 1, 0)).normalize()
      if (right.lengthSq() < .001) right.copy(shoulder)
      cameraUp.crossVectors(right, forward).normalize()
      const fits = [subject, target].every(body => {
        relative.copy(body.position).sub(position)
        const depth = relative.dot(forward), radius = body.size * .78
        return depth > radius && Math.abs(relative.dot(right)) + radius < depth * horizontal * .92 &&
          Math.abs(relative.dot(cameraUp)) + radius < depth * vertical * .92
      })
      if (fits) break
      distance *= 1.22
    }
  } else if (wide && target) {
    // A master shot establishes BOTH participants before the close coverage.
    focus.lerp(target.position,.5)
    const radius = Math.max(focus.distanceTo(subject.position)+subject.size*.72,focus.distanceTo(target.position)+target.size*.72)
    const angle = Math.atan(Math.min(vertical,horizontal))
    const distance = radius / Math.sin(angle) * (role === 'geography' ? 1.18 - progress*.12 : 1.08)
    position.copy(focus).addScaledVector(normal,distance*.95)
    position.y += distance*.31
  } else {
    // Frame the entire hull in portrait as well as landscape. A slow straight
    // dolly has a purpose (approach or release); there is no orbit or side flip.
    const size = subject.size
    const distance = Math.max(size*2.05, size*.85/horizontal, size*.52/vertical)
    const reaction = role === 'reaction' || role === 'impact'
    const release = role === 'resolution' ? 1 + progress*.38 : reaction ? 1 + .06 * ease((time-(sequence?.impactTime ?? shot.start))/3) : 1 - progress*.045
    const shoulder = role === 'opposition' ? .15 : 0
    position.copy(focus).addScaledVector(normal,distance*release).addScaledVector(axis,size*shoulder)
    position.y += size*(role === 'resolution' ? .65 : .38)
  }
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
  keepCameraOutsideHulls(frame.position,bodies.map(body=>({position:body.position,radius:body.size*.78})))
}
