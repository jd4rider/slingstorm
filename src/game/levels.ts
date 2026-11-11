import { GROUND_Y } from './config'
import type {
  BlockSpec,
  LevelData,
  MaterialId,
  Objective,
  ProjectileId,
  ShotSpec,
  TargetSpec,
} from './types'
import { worldDef } from '../data/worlds'

export const LEVELS_PER_WORLD = 50
export const TOTAL_LEVELS = 500

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Ctx {
  rng: () => number
  world: number
  difficulty: number
  palette: MaterialId[]
  tier: MaterialId
  trim: MaterialId
}

class Tower {
  blocks: BlockSpec[] = []
  targets: TargetSpec[] = []
  private blockId = 0
  private targetId = 0

  add(material: MaterialId, x: number, y: number, w: number, h: number, angle = 0, fixed = false): void {
    this.blocks.push({ id: `b${++this.blockId}`, x, y, w, h, angle, material, fixed })
  }

  /** A column standing on `baseY` with its top surface at baseY - h. */
  wall(material: MaterialId, cx: number, baseY: number, w: number, h: number): void {
    this.add(material, cx, baseY - h / 2, w, h)
  }

  /** A slab whose top surface sits at `topY`. */
  slab(material: MaterialId, cx: number, topY: number, w: number, h: number): void {
    this.add(material, cx, topY + h / 2, w, h)
  }

  grumplet(x: number, surfaceY: number): void {
    this.targets.push({
      id: `t${++this.targetId}`,
      x,
      y: surfaceY - 17,
      kind: 'grumplet',
      variant: this.targetId % 4,
    })
  }

  crystal(x: number, surfaceY: number): void {
    this.targets.push({
      id: `t${++this.targetId}`,
      x,
      y: surfaceY - 15,
      kind: 'crystal',
      variant: 0,
    })
  }
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!
}

/**
 * Tower centres. Every shot comes in from the left, so the structures stand on
 * the right of the ridge: the near tower first, the far one behind it, with the
 * ground in front of the slingshot kept clear for the launch.
 */
function baseX(side: 'left' | 'right'): number {
  return side === 'left' ? 452 : 604
}

function pickSide(ctx: Ctx): 'left' | 'right' {
  return ctx.rng() < 0.5 ? 'left' : 'right'
}

/** Two posts, a cap, and a pair of grumplets on top. The first real tower. */
function pillars(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 146 + Math.round(ctx.rng() * 8)
  const gap = 62
  t.wall(ctx.tier, bx - gap, GROUND_Y, 26, h)
  t.wall(ctx.tier, bx + gap, GROUND_Y, 26, h)
  const capTop = GROUND_Y - h - 24
  t.slab(ctx.trim, bx, capTop, 190, 24)
  t.grumplet(bx - 42, capTop)
  if (ctx.difficulty > 0.25 && ctx.rng() < 0.7) t.grumplet(bx + 44, capTop)
  if (ctx.rng() < 0.4) t.add('crate', bx, GROUND_Y - 20, 36, 36)
}

/** A little house: walls, roof, one grumplet sheltered inside and one above. */
function hut(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 116
  const wallMaterial = ctx.rng() < 0.35 ? ctx.trim : ctx.tier
  t.wall(wallMaterial, bx - 54, GROUND_Y, 24, h)
  t.wall(wallMaterial, bx + 54, GROUND_Y, 24, h)
  t.grumplet(bx, GROUND_Y)
  const capTop = GROUND_Y - h - 22
  t.slab(ctx.tier, bx, capTop, 152, 22)
  t.grumplet(bx, capTop)
  if (ctx.difficulty > 0.4) {
    t.add('glass', bx - 32, GROUND_Y - 34, 18, 68)
    t.add('glass', bx + 32, GROUND_Y - 34, 18, 68)
  }
}

/** Fragile glass legs under a heavy stone lid. Shatter the legs, drop the lid. */
function glasscase(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 132
  t.wall('glass', bx - 50, GROUND_Y, 20, h)
  t.wall('glass', bx + 50, GROUND_Y, 20, h)
  t.grumplet(bx, GROUND_Y)
  const capTop = GROUND_Y - h - 28
  t.slab('stone', bx, capTop, 168, 28)
  t.grumplet(bx, capTop)
  if (ctx.world >= 2) t.add('ice', bx - 64, capTop - 10, 40, 20)
}

/** A stepped slab pyramid; the higher you hit, the more comes down. */
function pyramid(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 32
  const widths = [200, 154, 108, 64]
  widths.forEach((w, row) => {
    const top = GROUND_Y - (row + 1) * h
    t.slab(row === widths.length - 1 ? ctx.trim : ctx.tier, bx, top, w, h)
  })
  t.grumplet(bx, GROUND_Y - widths.length * h)
}

/** Two narrow spires, each with its own lookout. */
function twin(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 128
  for (const offset of [-58, 58]) {
    const cx = bx + offset
    t.wall(ctx.tier, cx - 26, GROUND_Y, 22, h)
    t.wall(ctx.tier, cx + 26, GROUND_Y, 22, h)
    const top = GROUND_Y - h - 20
    t.slab(ctx.trim, cx, top, 96, 20)
    t.grumplet(cx, top)
  }
}

/** A plank bridge resting on both cliff tips, with the targets exposed on it. */
function bridge(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  void side
  const riserH = 58
  t.wall(ctx.trim, 440, GROUND_Y, 32, riserH)
  t.wall(ctx.trim, 640, GROUND_Y, 32, riserH)
  const beamTop = GROUND_Y - riserH - 18
  t.slab(ctx.tier, 540, beamTop, 240, 18)
  t.grumplet(496, beamTop)
  t.grumplet(584, beamTop)
  if (ctx.difficulty > 0.45) {
    t.add('crate', 540, beamTop - 20, 34, 34)
    t.grumplet(676, GROUND_Y)
  }
  if (ctx.difficulty > 0.7) t.add('stone', 540, beamTop - 50, 90, 26)
}

/** A reinforced hall: stone base, timber floor, metal lid. */
function fortress(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  for (const offset of [-84, 0, 84]) t.wall('stone', bx + offset, GROUND_Y, 52, 58)
  const floorTop = GROUND_Y - 58 - 20
  t.slab('wood', bx, floorTop, 220, 20)
  t.grumplet(bx, floorTop)
  t.wall(ctx.tier, bx - 76, floorTop, 24, 92)
  t.wall(ctx.tier, bx + 76, floorTop, 24, 92)
  const roofTop = floorTop - 92 - 18
  t.slab(ctx.world >= 4 ? 'metal' : 'stone', bx, roofTop, 196, 18)
  t.grumplet(bx - 40, roofTop)
  t.grumplet(bx + 44, roofTop)
  if (ctx.difficulty > 0.6) t.add('crate', bx + 42, floorTop - 22, 34, 34)
}

/** A tall, narrow stack that topples in satisfying stages. */
function stack(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 36
  const rows = 5 + (ctx.difficulty > 0.5 ? 1 : 0)
  for (let row = 0; row < rows; row += 1) {
    const material = row % 2 === 0 ? ctx.tier : ctx.trim
    const w = 112 - (row % 3) * 12
    t.slab(material, bx, GROUND_Y - (row + 1) * h, w, h)
  }
  t.grumplet(bx, GROUND_Y - rows * h)
}

/** Ice columns with a stone roof: a single shot can shear the whole thing. */
function icebox(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  const h = 118
  t.wall('ice', bx - 54, GROUND_Y, 22, h)
  t.wall('ice', bx + 54, GROUND_Y, 22, h)
  t.grumplet(bx - 26, GROUND_Y)
  t.grumplet(bx + 26, GROUND_Y)
  const capTop = GROUND_Y - h - 26
  t.slab('stone', bx, capTop, 176, 26)
  t.grumplet(bx, capTop)
  t.add('ice', bx + 64, capTop - 10, 40, 20)
}

/** Metal shield over glass legs: you have to go around or through. */
function vault(t: Tower, ctx: Ctx, side: 'left' | 'right'): void {
  const bx = baseX(side)
  t.wall('glass', bx - 62, GROUND_Y, 20, 104)
  t.wall('glass', bx + 62, GROUND_Y, 20, 104)
  t.grumplet(bx - 30, GROUND_Y)
  t.grumplet(bx + 30, GROUND_Y)
  const shellTop = GROUND_Y - 104 - 34
  t.slab('metal', bx, shellTop, 190, 34)
  t.grumplet(bx, shellTop)
  if (ctx.difficulty > 0.5) t.add('crystal', bx + 58, shellTop - 15, 34, 30)
}

const ARCHETYPES = ['pillars', 'hut', 'glasscase', 'pyramid', 'twin', 'stack', 'fortress', 'icebox', 'vault'] as const
type Archetype = (typeof ARCHETYPES)[number]

const BRIDGE_LEVELS = new Set([9, 17, 23, 31, 38, 44])

const TITLES: Record<Archetype | 'bridge', string> = {
  pillars: 'The Gateposts',
  hut: 'The Little House',
  glasscase: 'Glass Display',
  pyramid: 'Step Pyramid',
  twin: 'Twin Watchtowers',
  stack: 'The Tall Stack',
  fortress: 'Reinforced Hall',
  icebox: 'Ice Cellar',
  vault: 'The Vault',
  bridge: 'Bridge Over Nothing',
}

function chooseArchetype(ctx: Ctx, index: number): Archetype | 'bridge' {
  if (ctx.world >= 5 && BRIDGE_LEVELS.has(index)) return 'bridge'
  if (ctx.world === 2 && index % 5 === 0) return ctx.rng() < 0.5 ? 'icebox' : 'glasscase'
  if (ctx.world === 4 && index % 6 === 0) return 'vault'
  return ARCHETYPES[Math.floor(ctx.rng() * ARCHETYPES.length)]!
}

function buildTower(archetype: Archetype | 'bridge', ctx: Ctx): Tower {
  const tower = new Tower()
  if (archetype === 'bridge') {
    bridge(tower, ctx, 'left')
    return tower
  }
  const side = pickSide(ctx)
  switch (archetype) {
    case 'pillars':
      pillars(tower, ctx, side)
      break
    case 'hut':
      hut(tower, ctx, side)
      break
    case 'glasscase':
      glasscase(tower, ctx, side)
      break
    case 'pyramid':
      pyramid(tower, ctx, side)
      break
    case 'twin':
      twin(tower, ctx, side)
      break
    case 'stack':
      stack(tower, ctx, side)
      break
    case 'fortress':
      fortress(tower, ctx, side)
      break
    case 'icebox':
      icebox(tower, ctx, side)
      break
    case 'vault':
      vault(tower, ctx, side)
      break
  }
  return tower
}

function objectiveFor(targets: TargetSpec[], blocks: BlockSpec[], ctx: Ctx): Objective {
  if (ctx.world >= 1 && targets.length >= 2 && ctx.rng() < 0.28) {
    return { kind: 'defeat', count: Math.ceil(targets.length / 2) }
  }
  if (ctx.world >= 2 && ctx.rng() < 0.24) {
    const candidates: MaterialId[] = ['glass', 'ice', 'wood']
    const material = candidates.find((id) => blocks.filter((block) => block.material === id).length >= 2)
    if (material) {
      return { kind: 'material', count: Math.min(3, blocks.filter((block) => block.material === material).length), material }
    }
  }
  if (ctx.world >= 5 && ctx.rng() < 0.12) {
    return { kind: 'score', count: 3200 + Math.round(ctx.difficulty * 2600) }
  }
  return { kind: 'targets', count: targets.length }
}

function compress(queue: ProjectileId[]): ShotSpec[] {
  const shots: ShotSpec[] = []
  for (const type of queue) {
    const last = shots[shots.length - 1]
    if (last && last.type === type) last.count += 1
    else shots.push({ type, count: 1 })
  }
  return shots
}


export function buildLevel(id: number): LevelData {
  const clamped = Math.max(1, Math.min(TOTAL_LEVELS, Math.round(id)))
  const world = Math.floor((clamped - 1) / LEVELS_PER_WORLD)
  const index = (clamped - 1) % LEVELS_PER_WORLD
  const theme = worldDef(world)
  const seed = (clamped * 2654435761) % 4294967296
  const rng = mulberry32(seed)

  const difficulty = Math.min(1, index / (LEVELS_PER_WORLD - 1) * 0.72 + world * 0.028)
  const tier = pick(rng, theme.materials)
  const others = theme.materials.filter((material) => material !== tier)
  const trim = others.length > 0 ? pick(rng, others) : tier
  const ctx: Ctx = { rng, world, difficulty, palette: theme.materials, tier, trim }

  const archetype = chooseArchetype(ctx, index)
  const tower = buildTower(archetype, ctx)
  if (tower.targets.length === 0) tower.grumplet(baseX('left'), GROUND_Y)

  const objective = objectiveFor(tower.targets, tower.blocks, ctx)
  const baseGoal = objective.kind === 'targets' || objective.kind === 'defeat' ? objective.count : tower.targets.length
  const generosity = index < 3 ? 2 : world < 3 ? 2 : world < 6 ? 1 : 0
  const spare = Math.max(1, 3 - Math.floor(world / 4)) + generosity - 1
  const ammo = Math.max(baseGoal, tower.targets.length) + Math.max(1, spare)

  const queue: ProjectileId[] = []
  const signature = theme.signature
  // Open with the world's signature every few levels, otherwise a plain Pippin
  // so the special shot is a decision rather than a routine.
  for (let shot = 0; shot < ammo; shot += 1) {
    if (shot === 0) queue.push(index % 3 === 0 ? signature : 'pippin')
    else if (rng() < 0.42) queue.push(signature)
    else queue.push(pick(rng, theme.projectiles))
  }

  const targetShots = Math.max(1, tower.targets.length)
  const twoStar = Math.min(ammo, targetShots + 1)
  const threeStar = Math.min(twoStar, Math.max(1, targetShots))

  return {
    id: clamped,
    world,
    title: `${TITLES[archetype]} ${Math.floor(index / 5) + 1}`,
    blocks: tower.blocks,
    targets: tower.targets,
    shots: compress(queue),
    ammo,
    objective,
    starShots: [twoStar, threeStar],
    seed,
    archetype,
  }
}

/** A deterministic arena for the arcade modes, seeded by stage or date. */
export function buildArena(seed: number, world: number, difficulty: number): LevelData {
  const pseudoId = Math.max(1, Math.min(TOTAL_LEVELS, 1 + Math.floor(seed % TOTAL_LEVELS)))
  const base = buildLevel(pseudoId)
  if (Math.abs(difficulty - ((pseudoId - 1) % LEVELS_PER_WORLD) / (LEVELS_PER_WORLD - 1)) < 0.02) return base
  return buildLevel(Math.max(1, Math.min(TOTAL_LEVELS, world * LEVELS_PER_WORLD + 1 + Math.round(difficulty * 49))))
}

export function blockBounds(level: LevelData): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const block of level.blocks) {
    const halfW = block.w / 2
    const halfH = block.h / 2
    minX = Math.min(minX, block.x - halfW)
    maxX = Math.max(maxX, block.x + halfW)
    minY = Math.min(minY, block.y - halfH)
    maxY = Math.max(maxY, block.y + halfH)
  }
  return { minX, maxX, minY, maxY }
}

export function levelObjectiveText(level: LevelData): string {
  switch (level.objective.kind) {
    case 'targets':
      return level.objective.count === 1 ? 'Knock out the Grumplet' : `Knock out all ${level.objective.count} Grumplets`
    case 'defeat':
      return `Knock out ${level.objective.count} Grumplets`
    case 'material':
      return `Smash ${level.objective.count} ${level.objective.material} blocks`
    case 'score':
      return `Score ${level.objective.count.toLocaleString('en-US')}`
  }
}
