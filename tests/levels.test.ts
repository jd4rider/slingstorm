import { describe, expect, it } from 'vitest'
import { buildLevel, LEVELS_PER_WORLD, TOTAL_LEVELS } from '../src/game/levels'
import { GROUND_Y } from '../src/game/config'
import { worldDef } from '../src/data/worlds'
import { isReachable, simulateStability, TARGET_RADIUS } from './support'
import type { LevelData } from '../src/game/types'

function pairs<T>(items: T[]): [T, T][] {
  const out: [T, T][] = []
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) out.push([items[i]!, items[j]!])
  }
  return out
}

function boxOverlap(a: LevelData['blocks'][number], b: LevelData['blocks'][number], pad = 1.5): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - pad
  )
}

function targetOverlapsBlock(target: LevelData['targets'][number], block: LevelData['blocks'][number], pad = 1): boolean {
  const dx = Math.max(0, Math.abs(target.x - block.x) - block.w / 2)
  const dy = Math.max(0, Math.abs(target.y - block.y) - block.h / 2)
  return Math.hypot(dx, dy) < TARGET_RADIUS - pad
}

const LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, index) => buildLevel(index + 1))

describe('the 500-level journey', () => {
  it('has ten worlds of fifty levels', () => {
    expect(LEVELS.length).toBe(500)
    expect(LEVELS_PER_WORLD).toBe(50)
    for (const level of LEVELS) {
      expect(level.world).toBe(Math.floor((level.id - 1) / 50))
      expect(worldDef(level.world).id).toBe(level.world)
    }
  })

  it('keeps every block and target inside the playfield and off the cliffs', () => {
    for (const level of LEVELS) {
      for (const block of level.blocks) {
        expect(block.w).toBeGreaterThanOrEqual(18)
        expect(block.h).toBeGreaterThanOrEqual(18)
        expect(block.x - block.w / 2).toBeGreaterThanOrEqual(0)
        expect(block.x + block.w / 2).toBeLessThanOrEqual(720)
        expect(block.y - block.h / 2).toBeGreaterThan(80)
        expect(block.y + block.h / 2).toBeLessThanOrEqual(GROUND_Y + 1)
      }
      for (const target of level.targets) {
        expect(target.x).toBeGreaterThan(10)
        expect(target.x).toBeLessThan(710)
        expect(target.y).toBeGreaterThan(80)
        expect(target.y).toBeLessThan(GROUND_Y + 1)
      }
    }
  })

  it('never starts a level with overlapping pieces', () => {
    for (const level of LEVELS) {
      for (const [a, b] of pairs(level.blocks)) {
        expect(boxOverlap(a, b), `${level.id} ${a.id}/${b.id}`).toBe(false)
      }
      for (const [a, b] of pairs(level.targets)) {
        expect(
          Math.hypot(a.x - b.x, a.y - b.y) >= TARGET_RADIUS * 2 - 1,
          `${level.id} ${a.id}/${b.id}`,
        ).toBe(true)
      }
      for (const target of level.targets) {
        for (const block of level.blocks) {
          expect(targetOverlapsBlock(target, block), `${level.id} ${target.id}/${block.id}`).toBe(false)
        }
      }
    }
  })

  it('gives every level enough ammunition for its objective', () => {
    for (const level of LEVELS) {
      const shots = level.shots.reduce((sum, shot) => sum + shot.count, 0)
      expect(shots).toBe(level.ammo)
      if (level.objective.kind === 'targets') {
        expect(level.ammo).toBeGreaterThanOrEqual(level.objective.count)
      }
      expect(level.starShots[1]).toBeLessThanOrEqual(level.starShots[0])
      expect(level.starShots[0]).toBeLessThanOrEqual(level.ammo)
      expect(level.starShots[1]).toBeGreaterThanOrEqual(1)
    }
  })

  it('places every target where a shot can actually get to it', () => {
    for (const level of LEVELS) {
      for (const target of level.targets) {
        expect(isReachable(target.x, target.y), `${level.id} ${target.id} at ${target.x},${target.y}`).toBe(true)
      }
    }
  })

  it('stands up on its own without a shot', () => {
    for (const level of LEVELS) {
      const report = simulateStability(level, 140)
      expect(report.escaped, `${level.id} lost ${report.escaped.join(',')}`).toEqual([])
      expect(report.maxBlockDrift, `${level.id} block drifted`).toBeLessThan(12)
      expect(report.maxTargetDrift, `${level.id} target drifted`).toBeLessThan(40)
    }
  })
})
