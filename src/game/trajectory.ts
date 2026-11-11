import { MAX_SPEED, GRAVITY_Y, SLING } from './config'
import type { Vec2 } from './types'

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
 * Ballistic samples in 60 Hz steps. Matter is stepped twice per frame, which
 * halves the travel per substep but leaves the frame-to-frame path identical.
 */
export function predictPath(start: Vec2, velocity: Vec2, steps = 96, stride = 2): Vec2[] {
  const points: Vec2[] = []
  for (let step = 0; step <= steps; step += stride) {
    points.push({
      x: start.x + velocity.x * step,
      y: start.y + velocity.y * step + 0.5 * GRAVITY_Y * step * step,
    })
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

export const TRAJECTORY_GRAVITY = GRAVITY_Y
