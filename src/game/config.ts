/**
 * One source of truth for the vertical playfield. The physics world, the
 * trajectory preview and the artwork every read these numbers, so what the
 * dotted line promises is what the projectile actually does.
 */

export const DESIGN_W = 720
export const DESIGN_H = 1280

/** The two cliff tops the towers are built on. */
export const LEDGE_TOP = 760
export const LEDGES = [
  { x: 0, y: LEDGE_TOP, w: 250, h: 520 },
  { x: 470, y: LEDGE_TOP, w: 250, h: 520 },
] as const

/** Height of the open channel a shot has to thread, in design units. */
export const CORRIDOR = { x0: 250, x1: 470 }

export const SLING = {
  x: 360,
  /** The pouch sits here with a projectile loaded. */
  y: 992,
  /** Fork tips, used for the elastic bands. */
  leftTip: { x: 316, y: 902 },
  rightTip: { x: 404, y: 902 },
  /** Furthest the pouch can be pulled back. */
  maxPull: 132,
} as const

/**
 * Matter gravity at 60 Hz. Substeps halve the per-step travel, not the pull.
 * The launch speed and this value together set the range: v^2 / g is roughly
 * how far a full-power 45 degree shot carries. At 20 px per step against 0.45
 * gravity that is a little over 800 design units, so a full pull clears the
 * canyon lip and still lands on a cliff-top tower instead of shooting flat
 * past it.
 */
export const GRAVITY_Y = 0.5

/** Launch speed in design pixels per 60 Hz step at full pull. */
export const MAX_SPEED = 24

/** Physics is stepped twice per rendered frame so fast shots cannot tunnel. */
export const SUBSTEPS = 2
export const SUBSTEP_MS = 1000 / 120

export const PLAYER_RADIUS = 24

/** Blocks thinner than this can be tunneled by a full-power shot. */
export const MIN_BLOCK = 18
