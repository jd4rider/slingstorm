import Matter from 'matter-js'
import { GROUND, GROUND_Y, MATTER_GRAVITY_Y, SLING, MAX_SPEED } from '../src/game/config'
import { materialDef } from '../src/game/materials'
import { pullToVelocity, predictPath } from '../src/game/trajectory'
import type { LevelData, Vec2 } from '../src/game/types'

const { Engine, Bodies, Composite } = Matter

export const TARGET_RADIUS = 17

export interface HeadlessSim {
  engine: Matter.Engine
  blocks: Map<string, Matter.Body>
  targets: Map<string, Matter.Body>
}

/** Mirrors the bodies GameScene creates, with the same physics properties. */
export function createSim(level: LevelData): HeadlessSim {
  const engine = Engine.create()
  engine.gravity.y = MATTER_GRAVITY_Y
  engine.positionIterations = 8
  engine.velocityIterations = 6

  Composite.add(
    engine.world,
    Bodies.rectangle(GROUND.x + GROUND.w / 2, GROUND.y + GROUND.h / 2, GROUND.w, GROUND.h, {
      isStatic: true,
      friction: 0.95,
      label: 'ground',
    }),
  )

  const blocks = new Map<string, Matter.Body>()
  for (const block of level.blocks) {
    const def = materialDef(block.material)
    const body = Bodies.rectangle(block.x, block.y, block.w, block.h, {
      isStatic: Boolean(block.fixed),
      angle: block.angle ?? 0,
      density: def.density,
      friction: def.friction,
      frictionStatic: def.frictionStatic,
      restitution: def.restitution,
      slop: 0.02,
      label: `block:${block.id}`,
    })
    blocks.set(block.id, body)
    Composite.add(engine.world, body)
  }

  const targets = new Map<string, Matter.Body>()
  for (const target of level.targets) {
    const body = Bodies.circle(target.x, target.y, TARGET_RADIUS, {
      density: 0.0015,
      friction: 0.9,
      frictionStatic: 0.95,
      restitution: 0.02,
      label: `target:${target.id}`,
    })
    targets.set(target.id, body)
    Composite.add(engine.world, body)
  }

  return { engine, blocks, targets }
}

export interface StabilityReport {
  maxBlockDrift: number
  maxTargetDrift: number
  escaped: string[]
}

/** Runs the tower with no shot and reports whether anything moved on its own. */
export function simulateStability(level: LevelData, steps = 180): StabilityReport {
  const sim = createSim(level)
  const beforeBlocks = new Map<string, Vec2>()
  for (const [id, body] of sim.blocks) beforeBlocks.set(id, { x: body.position.x, y: body.position.y })
  const beforeTargets = new Map<string, Vec2>()
  for (const [id, body] of sim.targets) beforeTargets.set(id, { x: body.position.x, y: body.position.y })

  for (let step = 0; step < steps; step += 1) Matter.Engine.update(sim.engine, 1000 / 120)

  let maxBlockDrift = 0
  let maxTargetDrift = 0
  const escaped: string[] = []
  for (const [id, body] of sim.blocks) {
    const start = beforeBlocks.get(id)!
    const drift = Math.hypot(body.position.x - start.x, body.position.y - start.y)
    maxBlockDrift = Math.max(maxBlockDrift, drift)
    if (body.position.y > 1240 || body.position.x < -80 || body.position.x > 800) escaped.push(id)
  }
  for (const [id, body] of sim.targets) {
    const start = beforeTargets.get(id)!
    const drift = Math.hypot(body.position.x - start.x, body.position.y - start.y)
    maxTargetDrift = Math.max(maxTargetDrift, drift)
    if (body.position.y > 1240 || body.position.x < -80 || body.position.x > 800) escaped.push(id)
  }
  return { maxBlockDrift, maxTargetDrift, escaped }
}

const CELL = 12

/**
 * Every point a shot can physically reach from the pouch, sampled once and
 * cached. Cliffs block a path, ordinary blocks do not: a shot that reaches a
 * block also destroys it, so it can carry on to what is behind.
 */
let reachable: Set<string> | null = null

export function reachableCells(): Set<string> {
  if (reachable) return reachable
  const cells = new Set<string>()
  const mark = (point: Vec2): void => {
    cells.add(`${Math.round(point.x / CELL)},${Math.round(point.y / CELL)}`)
  }
  const blocked = (point: Vec2): boolean => point.y >= GROUND_Y

  // Aim is measured from the horizontal now: negative is a flat or slightly
  // dropping shot, positive lobs up over the near tower.
  for (let degrees = -12; degrees <= 80; degrees += 2) {
    const radians = (degrees * Math.PI) / 180
    for (let power = 0.3; power <= 1.0001; power += 0.05) {
      const pull = {
        x: -Math.cos(radians) * power * SLING.maxPull,
        y: Math.sin(radians) * power * SLING.maxPull,
      }
      const velocity = pullToVelocity(pull)
      const path = predictPath({ x: SLING.x, y: SLING.y }, velocity, 240, 2)
      for (const point of path) {
        if (blocked(point)) break
        if (point.y > 1320 || point.x < -60 || point.x > 780) break
        mark(point)
      }
    }
  }
  reachable = cells
  return cells
}

export function isReachable(x: number, y: number, radius = TARGET_RADIUS): boolean {
  const cells = reachableCells()
  const span = Math.ceil(radius / CELL)
  const cx = Math.round(x / CELL)
  const cy = Math.round(y / CELL)
  for (let dx = -span; dx <= span; dx += 1) {
    for (let dy = -span; dy <= span; dy += 1) {
      if (cells.has(`${cx + dx},${cy + dy}`)) return true
    }
  }
  return false
}

/** Direct-hit flight time check for the first target, used to sanity check aim. */
export function simulateShot(level: LevelData, degrees: number, power: number, steps = 200): { hit: boolean; path: Vec2[] } {
  const radians = (degrees * Math.PI) / 180
  const pull = { x: -Math.cos(radians) * power * SLING.maxPull, y: Math.sin(radians) * power * SLING.maxPull }
  const velocity = pullToVelocity(pull)
  const path = predictPath({ x: SLING.x, y: SLING.y }, velocity, steps, 1)
  const target = level.targets[0]
  const hit = target ? path.some((point) => Math.hypot(point.x - target.x, point.y - target.y) < TARGET_RADIUS + 24) : false
  return { hit, path }
}

export const MAX_LAUNCH = MAX_SPEED
