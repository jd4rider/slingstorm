import { materialDef } from './materials'
import type { MaterialId } from './types'

/**
 * Damage is deliberately separate from the physics: Matter moves bodies, this
 * module decides what a hit costs. Energy is an estimate from the reduced mass
 * and the closing speed, never a solver-reported value.
 */
export const DAMAGE_K = 9.5

export function impactEnergy(relativeSpeed: number, reducedMass: number): number {
  return 0.5 * reducedMass * relativeSpeed * relativeSpeed
}

export function damageFor(energy: number, material: MaterialId, multiplier = 1): number {
  if (!Number.isFinite(energy) || energy <= 0) return 0
  return (energy * DAMAGE_K * multiplier) / materialDef(material).toughness
}

/** A visible crack appears below this fraction of remaining health. */
export const CRACK_AT = 0.66
export const HEAVY_CRACK_AT = 0.33

export function damageStage(health: number, max: number): 0 | 1 | 2 {
  if (max <= 0) return 0
  const ratio = health / max
  if (ratio <= HEAVY_CRACK_AT) return 2
  if (ratio <= CRACK_AT) return 1
  return 0
}

/** Explosions fall off linearly to zero at the edge of the blast. */
export function blastFalloff(distance: number, radius: number): number {
  if (distance >= radius) return 0
  return 1 - distance / radius
}

export interface BlastTarget {
  x: number
  y: number
  radius: number
}

export function inBlast(origin: { x: number; y: number }, target: BlastTarget, radius: number): boolean {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  return Math.sqrt(dx * dx + dy * dy) <= radius + target.radius
}
