export interface Vec2 {
  x: number
  y: number
}

export type MaterialId =
  | 'wood'
  | 'glass'
  | 'stone'
  | 'ice'
  | 'metal'
  | 'rubber'
  | 'crate'
  | 'crystal'

export type ProjectileId =
  | 'pippin'
  | 'boomkin'
  | 'triplet'
  | 'borebit'
  | 'zing'
  | 'frostpop'
  | 'ricco'
  | 'wrecker'
  | 'flux'
  | 'nimbus'

export type TargetKind = 'grumplet' | 'crystal'

export interface BlockSpec {
  id: string
  x: number
  y: number
  w: number
  h: number
  angle?: number
  material: MaterialId
  /** Anchored scenery. Static blocks never take damage. */
  fixed?: boolean
}

export interface TargetSpec {
  id: string
  x: number
  y: number
  kind: TargetKind
  /** Which grumplet face / colour variant to draw. */
  variant: number
}

export interface ShotSpec {
  type: ProjectileId
  count: number
}

export type ObjectiveKind = 'targets' | 'defeat' | 'material' | 'score'

export interface Objective {
  kind: ObjectiveKind
  count: number
  material?: MaterialId
}

export interface LevelData {
  id: number
  world: number
  title: string
  blocks: BlockSpec[]
  targets: TargetSpec[]
  shots: ShotSpec[]
  ammo: number
  objective: Objective
  /** Shots used that still earn two and three stars. */
  starShots: [number, number]
  seed: number
  archetype: string
}

export type GameMode = 'journey' | 'endless' | 'blitz' | 'precision' | 'zen' | 'daily'

export interface RunSummary {
  mode: GameMode
  levelId?: number
  world: number
  won: boolean
  score: number
  stars: number
  shotsUsed: number
  ammo: number
  targetsDefeated: number
  targetsTotal: number
  blocksDestroyed: number
  bestCombo: number
  elapsedMs: number
}

export interface ObjectiveStats {
  targetsDefeated: number
  blocksDestroyed: number
  materialDestroyed: Record<string, number>
  score: number
}
