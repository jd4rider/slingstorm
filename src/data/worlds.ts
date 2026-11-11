import type { MaterialId, ProjectileId } from '../game/types'

export interface WorldDef {
  id: number
  name: string
  tagline: string
  /** Sky gradient, top to bottom. */
  sky: [string, string]
  /** Distant hills and near ground. */
  far: string
  near: string
  accent: string
  /** Materials this world's towers are built from. */
  materials: MaterialId[]
  /** Slinglings the level generator may hand out here. */
  projectiles: ProjectileId[]
  /** The world's signature Slingling, always in the first slot. */
  signature: ProjectileId
}

export const WORLDS: WorldDef[] = [
  {
    id: 0,
    name: 'Sunny Sling Valley',
    tagline: 'Where every slingling learns to fly.',
    sky: ['#8fd6ff', '#ffe4b8'],
    far: '#7fb7d8',
    near: '#5c9a54',
    accent: '#ffb62e',
    materials: ['wood', 'glass'],
    projectiles: ['pippin', 'pippin', 'boomkin'],
    signature: 'pippin',
  },
  {
    id: 1,
    name: 'Crystal Cliffs',
    tagline: 'Shiny, sharp and very breakable.',
    sky: ['#5ec8f0', '#c8f2ff'],
    far: '#4d93b8',
    near: '#3f7f9c',
    accent: '#5ff0ff',
    materials: ['glass', 'stone', 'wood'],
    projectiles: ['pippin', 'triplet', 'ricco'],
    signature: 'pippin',
  },
  {
    id: 2,
    name: 'Frostfall Fortress',
    tagline: 'Cold walls, brittle hearts.',
    sky: ['#9fd8ff', '#e8f8ff'],
    far: '#8ab6d6',
    near: '#cfe9f7',
    accent: '#a8f0ff',
    materials: ['ice', 'stone', 'glass'],
    projectiles: ['frostpop', 'pippin', 'wrecker'],
    signature: 'frostpop',
  },
  {
    id: 3,
    name: 'Boomtown Canyon',
    tagline: 'One crate is a promise, not a threat.',
    sky: ['#ffb07a', '#ffe0a8'],
    far: '#c06a42',
    near: '#8f4a2c',
    accent: '#ff7a35',
    materials: ['crate', 'wood', 'stone'],
    projectiles: ['boomkin', 'pippin', 'wrecker'],
    signature: 'boomkin',
  },
  {
    id: 4,
    name: 'Clockwork Kingdom',
    tagline: 'Rivets, beams and a very smug foreman.',
    sky: ['#6f7fa8', '#e0c68a'],
    far: '#5a6484',
    near: '#3f465e',
    accent: '#ffcf6a',
    materials: ['metal', 'wood', 'stone'],
    projectiles: ['borebit', 'pippin', 'wrecker'],
    signature: 'borebit',
  },
  {
    id: 5,
    name: 'Jungle Towers',
    tagline: 'The vines hold more than they should.',
    sky: ['#8fe0b0', '#e9ffcf'],
    far: '#4f9b70',
    near: '#2f6b4a',
    accent: '#9cff6a',
    materials: ['wood', 'rubber', 'glass'],
    projectiles: ['nimbus', 'pippin', 'triplet'],
    signature: 'nimbus',
  },
  {
    id: 6,
    name: 'Sky Castle Isles',
    tagline: 'Mind the drop. It is a long one.',
    sky: ['#8cc8ff', '#fff0d6'],
    far: '#9db9de',
    near: '#7a9ac4',
    accent: '#ffd889',
    materials: ['stone', 'glass', 'wood'],
    projectiles: ['pippin', 'ricco', 'wrecker'],
    signature: 'pippin',
  },
  {
    id: 7,
    name: 'Neon Factory',
    tagline: 'Conductive, magnetic, extremely loud.',
    sky: ['#3a2a6e', '#7a3fa0'],
    far: '#2b1f5a',
    near: '#1b143a',
    accent: '#ff58d8',
    materials: ['metal', 'crystal', 'glass'],
    projectiles: ['zing', 'pippin', 'flux'],
    signature: 'zing',
  },
  {
    id: 8,
    name: 'Cosmic Citadel',
    tagline: 'Built from star shards and stubbornness.',
    sky: ['#201a4e', '#5a3f9e'],
    far: '#3a2a72',
    near: '#241a52',
    accent: '#b78cff',
    materials: ['crystal', 'metal', 'ice'],
    projectiles: ['zing', 'wrecker', 'boomkin'],
    signature: 'zing',
  },
  {
    id: 9,
    name: 'Stormheart Kingdom',
    tagline: 'The last towers. The biggest storm.',
    sky: ['#2b2140', '#7a4a52'],
    far: '#402c45',
    near: '#241a2c',
    accent: '#ffb04a',
    materials: ['stone', 'metal', 'crystal', 'wood'],
    projectiles: ['pippin', 'wrecker', 'boomkin', 'frostpop', 'zing'],
    signature: 'wrecker',
  },
]

export function worldDef(world: number): WorldDef {
  return WORLDS[Math.max(0, Math.min(WORLDS.length - 1, world))]!
}

export function worldOfLevel(levelId: number): number {
  return Math.floor((levelId - 1) / 50)
}
