import { materialDef } from './materials'
import type { MaterialId } from './types'

export const TARGET_SCORE = 1000
export const UNUSED_SHOT_BONUS = 2500
export const CRYSTAL_SCORE = 1500

export function comboMultiplier(chain: number): number {
  return 1 + Math.max(0, chain - 1) * 0.3
}

export function blockScore(material: MaterialId, chain: number): number {
  return Math.round(materialDef(material).score * comboMultiplier(chain))
}

export function targetScore(kind: 'grumplet' | 'crystal', chain: number): number {
  const base = kind === 'crystal' ? CRYSTAL_SCORE : TARGET_SCORE
  return Math.round(base * comboMultiplier(chain))
}

export function unusedShotScore(shotsLeft: number): number {
  return Math.max(0, shotsLeft) * UNUSED_SHOT_BONUS
}

export const COMBO_WORDS = [
  'NICE SHOT!',
  'DOUBLE CRASH!',
  'TRIPLE TROUBLE!',
  'MEGA COLLAPSE!',
  'DESTRUCTION FRENZY!',
  'SLINGSTORM!',
]

export function comboWord(chain: number): string {
  if (chain <= 1) return COMBO_WORDS[0]!
  return COMBO_WORDS[Math.min(COMBO_WORDS.length - 1, chain - 1)]!
}

export const FEVER_CHARGE = 100
export const FEVER_SECONDS = 10

export function feverChargeFor(kind: 'block' | 'target' | 'crate', chain: number): number {
  const base = kind === 'target' ? 18 : kind === 'crate' ? 10 : 3.5
  return base * (1 + Math.max(0, chain - 1) * 0.2)
}
