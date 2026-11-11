/**
 * One source of truth for the playfield. The physics world, the trajectory
 * preview and the artwork each read these numbers, so what the dotted line
 * promises is what the projectile actually does.
 *
 * The board is a side view: the slingshot stands on the left of a long ridge,
 * the towers stand on the right, and every shot travels left to right.
 */

export const DESIGN_W = 720
export const DESIGN_H = 1280

/** Top surface of the ridge the slingshot and every tower stand on. */
export const GROUND_Y = 880

/** The ridge itself: one static body, drawn by GameScene. */
export const GROUND = { x: -360, y: GROUND_Y, w: 1440, h: 520 } as const

export const SLING = {
  x: 168,
  /** The pouch sits here with a projectile loaded. */
  y: GROUND_Y - 112,
  /** Fork tips, used for the elastic bands. */
  leftTip: { x: 124, y: GROUND_Y - 202 },
  rightTip: { x: 212, y: GROUND_Y - 202 },
  /** Furthest the pouch can be pulled back, down the ridge to the left. */
  maxPull: 128,
} as const

/**
 * Matter gravity. Matter multiplies `gravity.y` by `gravity.scale` (0.001) and
 * by the squared step in milliseconds, so a body gains
 * `gravity.y * 0.001 * (1000 / 60)^2` pixels of velocity per 60 Hz frame.
 * 1.8 therefore falls at 0.5 px per frame squared, which is the rate the aim
 * guide integrates. Matter's default of 1 falls at little more than half that,
 * which is why every shot used to sail high over the drawn line.
 */
export const MATTER_GRAVITY_Y = 1.8

/** Launch speed in design pixels per 60 Hz frame at full pull. */
export const MAX_SPEED = 24

/** Physics is stepped twice per rendered frame so fast shots cannot tunnel. */
export const SUBSTEPS = 2
export const SUBSTEP_MS = 1000 / 120

export const PLAYER_RADIUS = 24

/** Blocks thinner than this can be tunneled by a full-power shot. */
export const MIN_BLOCK = 18
