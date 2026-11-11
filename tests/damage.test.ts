import { describe, expect, it } from 'vitest'
import { blastFalloff, damageFor, damageStage, impactEnergy } from '../src/game/damage'
import { materialDef } from '../src/game/materials'
import { projectileDef } from '../src/game/projectiles'
import { buildLevel } from '../src/game/levels'
import { comboMultiplier, blockScore, unusedShotScore, targetScore } from '../src/game/scoring'
import { objectiveComplete, objectiveValue, starsFor } from '../src/game/progress'
import { pullToVelocity, predictPath, firstIntersection } from '../src/game/trajectory'

/** A standard full-power Pippin hitting a block that is barely moving. */
function pippinEnergy(): number {
  const pull = { x: 0, y: 132 }
  const velocity = pullToVelocity(pull)
  const speed = Math.hypot(velocity.x, velocity.y)
  const radius = projectileDef('pippin').radius
  const shipMass = Math.PI * radius * radius * projectileDef('pippin').density
  const blockMass = 26 * 146 * materialDef('wood').density
  return impactEnergy(speed, (shipMass * blockMass) / (shipMass + blockMass))
}

describe('damage model', () => {
  it('shatters glass and ice in a single clean hit', () => {
    const energy = pippinEnergy()
    expect(damageFor(energy, 'glass')).toBeGreaterThanOrEqual(materialDef('glass').health)
    expect(damageFor(energy, 'ice')).toBeGreaterThanOrEqual(materialDef('ice').health)
    expect(damageFor(energy, 'crystal')).toBeGreaterThanOrEqual(materialDef('crystal').health)
  })

  it('makes wood take real work and stone take more', () => {
    const energy = pippinEnergy()
    const wood = damageFor(energy, 'wood')
    const stone = damageFor(energy, 'stone')
    expect(wood).toBeGreaterThan(materialDef('wood').health * 0.6)
    expect(wood).toBeLessThan(materialDef('wood').health * 1.6)
    expect(stone).toBeLessThan(materialDef('stone').health * 0.5)
    expect(stone).toBeGreaterThan(0)
  })

  it('barely scratches metal', () => {
    const energy = pippinEnergy()
    expect(damageFor(energy, 'metal')).toBeLessThan(materialDef('metal').health * 0.12)
  })

  it('gives the heavy Wrecker meaningfully more punch', () => {
    const energy = pippinEnergy()
    const heavy = damageFor(energy, 'stone', projectileDef('wrecker').damageMul)
    const normal = damageFor(energy, 'stone')
    expect(heavy / normal).toBeGreaterThan(2)
  })

  it('reports crack stages as health falls', () => {
    expect(damageStage(100, 100)).toBe(0)
    expect(damageStage(60, 100)).toBe(1)
    expect(damageStage(20, 100)).toBe(2)
    expect(damageStage(0, 0)).toBe(0)
  })

  it('falls blast damage off with distance', () => {
    expect(blastFalloff(0, 120)).toBe(1)
    expect(blastFalloff(60, 120)).toBeCloseTo(0.5)
    expect(blastFalloff(120, 120)).toBe(0)
  })
})

describe('trajectory matches the physics', () => {
  it('launches opposite the pull, upward for a downward pull', () => {
    const velocity = pullToVelocity({ x: 0, y: 100 })
    expect(velocity.y).toBeLessThan(-10)
    expect(Math.abs(velocity.x)).toBeLessThan(0.001)
  })

  it('reaches at least 560 units above the pouch at full power', () => {
    const velocity = pullToVelocity({ x: 0, y: 132 })
    const path = predictPath({ x: 360, y: 992 }, velocity)
    const highest = Math.min(...path.map((point) => point.y))
    expect(highest).toBeLessThan(430)
  })

  it('stops the guide line on the first block it would hit', () => {
    const path = predictPath({ x: 360, y: 992 }, { x: 0, y: -30 })
    const hit = firstIntersection(path, [{ x: 360, y: 700, w: 200, h: 24 }], 24)
    expect(hit).not.toBeNull()
    expect(hit!.point.y).toBeGreaterThan(660)
  })
})

describe('scoring and stars', () => {
  it('escalates with the chain', () => {
    expect(comboMultiplier(1)).toBe(1)
    expect(comboMultiplier(3)).toBeCloseTo(1.6)
    expect(blockScore('glass', 2)).toBeGreaterThan(blockScore('glass', 1))
    expect(targetScore('crystal', 1)).toBeGreaterThan(targetScore('grumplet', 1))
  })

  it('pays for ammunition you never needed', () => {
    expect(unusedShotScore(3)).toBe(7500)
    expect(unusedShotScore(0)).toBe(0)
  })

  it('awards three stars only at the tight threshold', () => {
    const level = buildLevel(12)
    expect(starsFor(level, level.starShots[1])).toBe(3)
    expect(starsFor(level, level.starShots[0])).toBe(2)
    expect(starsFor(level, level.starShots[0] + 1)).toBe(1)
  })

  it('tracks every objective kind', () => {
    const level = buildLevel(7)
    const base = { targetsDefeated: 0, blocksDestroyed: 0, materialDestroyed: {}, score: 0 }
    expect(objectiveComplete(level, base)).toBe(false)
    const filled = {
      targetsDefeated: 99,
      blocksDestroyed: 99,
      materialDestroyed: { wood: 99, glass: 99, ice: 99, stone: 99 },
      score: 999999,
    }
    expect(objectiveComplete(level, filled)).toBe(true)
    expect(objectiveValue(level, filled)).toBe(level.objective.count)
  })
})
