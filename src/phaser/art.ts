/** Frame counts and keys shared with art/blender/characters.py. */

export interface ActionFrames {
  frames: number
  fps: number
  repeat: boolean
}

export const SLINGLING_ACTIONS: Record<string, ActionFrames> = {
  idle: { frames: 8, fps: 7, repeat: true },
  blink: { frames: 4, fps: 12, repeat: true },
  launch: { frames: 6, fps: 14, repeat: false },
  happy: { frames: 6, fps: 10, repeat: true },
  scared: { frames: 4, fps: 10, repeat: true },
}

export const GRUMPLET_ACTIONS: Record<string, ActionFrames> = {
  idle: { frames: 6, fps: 7, repeat: true },
  blink: { frames: 4, fps: 10, repeat: true },
  panic: { frames: 6, fps: 12, repeat: true },
}

export const SLINGLING_KEYS = [
  'pippin',
  'boomkin',
  'triplet',
  'borebit',
  'zing',
  'frostpop',
  'ricco',
  'wrecker',
  'flux',
  'nimbus',
] as const

export const GRUMPLET_KEYS = ['0', '1', '2', '3'] as const

export const ART_FRAME_SIZE = 128
