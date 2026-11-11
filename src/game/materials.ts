import type { MaterialId } from './types'

export interface MaterialDef {
  id: MaterialId
  name: string
  density: number
  friction: number
  frictionStatic: number
  restitution: number
  health: number
  /** How much impact energy one point of damage costs. */
  toughness: number
  score: number
  color: number
  edge: number
  light: number
  /** Explosive crates take damage from the blast they release. */
  explosive?: boolean
  brittle?: boolean
  conductive?: boolean
  magnetic?: boolean
}

/**
 * Tuning notes: a standard Pippin at full pull carries about 3,900 units of
 * impact energy against a block, so wood breaks in roughly one and a half
 * solid hits, glass and ice shatter at once, stone takes a few and metal
 * shrugs almost everything off. Those ratios are asserted in the tests rather
 * than left to feel.
 */
export const MATERIALS: Record<MaterialId, MaterialDef> = {
  wood: {
    id: 'wood',
    name: 'Wood',
    density: 0.0018,
    friction: 0.86,
    frictionStatic: 0.95,
    restitution: 0.04,
    health: 110,
    toughness: 70,
    score: 50,
    color: 0xb8793c,
    edge: 0x6f4318,
    light: 0xe2ab6d,
  },
  glass: {
    id: 'glass',
    name: 'Glass',
    density: 0.0013,
    friction: 0.42,
    frictionStatic: 0.5,
    restitution: 0.06,
    health: 55,
    toughness: 22,
    score: 75,
    color: 0x9fe6ff,
    edge: 0x3f93b8,
    light: 0xeafbff,
    brittle: true,
  },
  stone: {
    id: 'stone',
    name: 'Stone',
    density: 0.0034,
    friction: 0.9,
    frictionStatic: 0.98,
    restitution: 0.02,
    health: 230,
    toughness: 120,
    score: 100,
    color: 0x98a1b0,
    edge: 0x565f6d,
    light: 0xc8cfda,
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    density: 0.0014,
    // Slippery against a shot, but stable enough to hold a stone lid up.
    friction: 0.55,
    frictionStatic: 0.62,
    restitution: 0.05,
    health: 70,
    toughness: 30,
    score: 90,
    color: 0xbfefff,
    edge: 0x5fa9c6,
    light: 0xf4ffff,
    brittle: true,
  },
  metal: {
    id: 'metal',
    name: 'Metal',
    density: 0.0055,
    friction: 0.68,
    frictionStatic: 0.8,
    restitution: 0.1,
    health: 760,
    toughness: 330,
    score: 150,
    color: 0xb3becd,
    edge: 0x606b7c,
    light: 0xeef4fb,
    conductive: true,
    magnetic: true,
  },
  rubber: {
    id: 'rubber',
    name: 'Rubber',
    density: 0.0016,
    friction: 0.95,
    frictionStatic: 0.99,
    // Bouncy enough to feel like rubber, not so bouncy the tower jitters.
    restitution: 0.55,
    health: 160,
    toughness: 95,
    score: 60,
    color: 0x6f5bd4,
    edge: 0x352379,
    light: 0xb8a9ff,
  },
  crate: {
    id: 'crate',
    name: 'Boom Crate',
    density: 0.0018,
    friction: 0.8,
    frictionStatic: 0.9,
    restitution: 0.05,
    health: 55,
    toughness: 32,
    score: 120,
    color: 0xef7a3a,
    edge: 0x8d3512,
    light: 0xffc28c,
    explosive: true,
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal',
    density: 0.0015,
    friction: 0.5,
    frictionStatic: 0.6,
    restitution: 0.08,
    health: 50,
    toughness: 24,
    score: 200,
    color: 0x6ce0ff,
    edge: 0x2a7fa8,
    light: 0xd6ffff,
    brittle: true,
  },
}

export function materialDef(id: MaterialId): MaterialDef {
  return MATERIALS[id]
}

/** Materials a level may legitimately ask a player to clear. */
export const DESTRUCTIBLE = [
  'wood',
  'glass',
  'stone',
  'ice',
  'metal',
  'rubber',
  'crate',
  'crystal',
] as const
