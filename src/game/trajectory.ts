import { MATTER_GRAVITY_Y, MAX_SPEED, SLING, SUBSTEPS, SUBSTEP_MS } from './config'
import type { Vec2 } from './types'

const BASE_STEP_MS = 1000 / 60
/** One physics step, expressed as a fraction of a 60 Hz frame. */
const STEP_FROM_FRAME = SUBSTEP_MS / BASE_STEP_MS
/** Air drag of every projectile body GameScene launches. */
const AIR = 0.002
/** Matter adds `gravity.y * gravity.scale * step^2` px of velocity per step. */
const GRAVITY_STEP = MATTER_GRAVITY_Y * 0.001 * SUBSTEP_MS * SUBSTEP_MS

/**
 * The drag vector runs from the pouch to the pointer. The launch is the
 * opposite direction, with power taken from how far the pouch is stretched.
 * The curve is gentle at short pulls so fine aiming stays possible.
 */
export function pullToVelocity(pull: Vec2): Vec2 {
  const length = Math.hypot(pull.x, pull.y)
  if (length < 0.001) return { x: 0, y: 0 }
  const clamped = Math.min(length, SLING.maxPull)
  const speed = MAX_SPEED * Math.pow(clamped / SLING.maxPull, 0.86)
  return { x: (-pull.x / length) * speed, y: (-pull.y / length) * speed }
}

export function pullPower(pull: Vec2): number {
  return Math.min(1, Math.hypot(pull.x, pull.y) / SLING.maxPull)
}

/**
 * The arc the shot will really fly, integrated the way Matter integrates it:
 * two substeps per frame with air drag, including the one-off correction Matter
 * applies to the first step of a freshly created body. Sampling once per frame
 * keeps the dots on the same clock as the renderer, and because this is the
 * same integrator the physics uses, the guide cannot drift away from the shot.
 */
export function predictPath(start: Vec2, velocity: Vec2, steps = 96, stride = 2): Vec2[] {
  const points: Vec2[] = [{ x: start.x, y: start.y }]
  const friction = 1 - AIR * STEP_FROM_FRAME
  let prevX = start.x - velocity.x
  let prevY = start.y - velocity.y
  let x = start.x
  let y = start.y
  let first = true
  for (let frame = 0; frame <= steps; frame += 1) {
    if (frame > 0 && frame % stride === 0) points.push({ x, y })
    for (let step = 0; step < SUBSTEPS; step += 1) {
      const correction = first ? STEP_FROM_FRAME : 1
      first = false
      const vx = (x - prevX) * correction * friction
      const vy = (y - prevY) * correction * friction + GRAVITY_STEP
      prevX = x
      prevY = y
      x += vx
      y += vy
    }
  }
  return points
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
  angle?: number
}

function inside(point: Vec2, box: Box, pad: number): boolean {
  const dx = point.x - box.x
  const dy = point.y - box.y
  const angle = -(box.angle ?? 0)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const lx = dx * cos - dy * sin
  const ly = dx * sin + dy * cos
  return Math.abs(lx) <= box.w / 2 + pad && Math.abs(ly) <= box.h / 2 + pad
}

/** First sample that lands inside a block, used to cap the guide line. */
export function firstIntersection(path: Vec2[], boxes: Box[], radius = 0): { index: number; point: Vec2 } | null {
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!
    if (point.x < -20 || point.x > 740 || point.y > 1300) return { index, point }
    for (const box of boxes) {
      if (inside(point, box, radius * 0.6)) return { index, point }
    }
  }
  return null
}

export function pathHitsCircle(path: Vec2[], centre: Vec2, radius: number): boolean {
  return path.some((point) => Math.hypot(point.x - centre.x, point.y - centre.y) <= radius)
}
