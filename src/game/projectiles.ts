import type { ProjectileId } from './types'

export type AbilityId =
  | 'none'
  | 'blast'
  | 'split'
  | 'drill'
  | 'chain'
  | 'freeze'
  | 'bounce'
  | 'heavy'
  | 'magnet'
  | 'gust'

export interface ProjectileDef {
  id: ProjectileId
  name: string
  ability: AbilityId
  /** Collision radius in design units; the artwork is drawn to match. */
  radius: number
  density: number
  /** Multiplies the damage this projectile deals. */
  damageMul: number
  /** Matter restitution override, for Ricco. */
  restitution?: number
  blurb: string
  color: string
  deep: string
  light: string
  /** Blender character colour key. */
  art: string
}

export const PROJECTILES: Record<ProjectileId, ProjectileDef> = {
  pippin: {
    id: 'pippin',
    name: 'Pippin',
    ability: 'none',
    radius: 25,
    density: 0.0022,
    damageMul: 1,
    blurb: 'A steady all-rounder. No tricks, all heart.',
    color: '#ffcb2e',
    deep: '#c98d00',
    light: '#fff0b0',
    art: 'pippin',
  },
  boomkin: {
    id: 'boomkin',
    name: 'Boomkin',
    ability: 'blast',
    radius: 26,
    density: 0.0024,
    damageMul: 1.1,
    blurb: 'Tap in flight to detonate. Break the supports, not your aim.',
    color: '#ff6b3d',
    deep: '#b62f10',
    light: '#ffd0b5',
    art: 'boomkin',
  },
  triplet: {
    id: 'triplet',
    name: 'Triplet',
    ability: 'split',
    radius: 26,
    density: 0.0018,
    damageMul: 0.62,
    blurb: 'Tap in flight to split into three across a wide fan.',
    color: '#7ee36a',
    deep: '#2f8a25',
    light: '#d9ffcf',
    art: 'triplet',
  },
  borebit: {
    id: 'borebit',
    name: 'Borebit',
    ability: 'drill',
    radius: 24,
    density: 0.0028,
    damageMul: 1.3,
    blurb: 'Tap to drill forward, chewing through wood and glass.',
    color: '#d9a15a',
    deep: '#8a5a1c',
    light: '#ffe6bd',
    art: 'borebit',
  },
  zing: {
    id: 'zing',
    name: 'Zing',
    ability: 'chain',
    radius: 24,
    density: 0.0021,
    damageMul: 0.9,
    blurb: 'Tap near a structure to arc lightning through three bodies.',
    color: '#ffe94a',
    deep: '#c1a300',
    light: '#fffbc0',
    art: 'zing',
  },
  frostpop: {
    id: 'frostpop',
    name: 'Frostpop',
    ability: 'freeze',
    radius: 25,
    density: 0.0022,
    damageMul: 1,
    blurb: 'Tap to freeze everything close by, making it brittle.',
    color: '#8fe6ff',
    deep: '#2f9dbf',
    light: '#e8fdff',
    art: 'frostpop',
  },
  ricco: {
    id: 'ricco',
    name: 'Ricco',
    ability: 'bounce',
    radius: 24,
    density: 0.0022,
    damageMul: 0.85,
    restitution: 0.92,
    blurb: 'A bank-shot specialist. Tap to give it one midair nudge.',
    color: '#ff7bd6',
    deep: '#b3318c',
    light: '#ffd4f2',
    art: 'ricco',
  },
  wrecker: {
    id: 'wrecker',
    name: 'Wrecker',
    ability: 'heavy',
    radius: 33,
    density: 0.0052,
    damageMul: 2.2,
    blurb: 'Slow, enormous and superb at taking out supports.',
    color: '#9aa7bd',
    deep: '#525f74',
    light: '#e6edf8',
    art: 'wrecker',
  },
  flux: {
    id: 'flux',
    name: 'Flux',
    ability: 'magnet',
    radius: 25,
    density: 0.0023,
    damageMul: 0.9,
    blurb: 'Tap to shove every nearby metal body away.',
    color: '#b28dff',
    deep: '#6a41c9',
    light: '#e8dcff',
    art: 'flux',
  },
  nimbus: {
    id: 'nimbus',
    name: 'Nimbus',
    ability: 'gust',
    radius: 26,
    density: 0.0016,
    damageMul: 0.7,
    blurb: 'Tap to unleash a gust that pushes light structures over.',
    color: '#bdf0e2',
    deep: '#4fa88f',
    light: '#f0fffb',
    art: 'nimbus',
  },
}

export function projectileDef(id: ProjectileId): ProjectileDef {
  return PROJECTILES[id]
}

export const ABILITY_LABEL: Record<AbilityId, string> = {
  none: 'No ability',
  blast: 'Detonate',
  split: 'Split',
  drill: 'Drill',
  chain: 'Chain lightning',
  freeze: 'Freeze',
  bounce: 'Nudge',
  heavy: 'Crush',
  magnet: 'Repel metal',
  gust: 'Gust',
}
