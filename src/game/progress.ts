import type { LevelData, ObjectiveStats } from './types'

export function objectiveTarget(level: LevelData): number {
  return level.objective.count
}

/** How far the player is through the primary objective, clamped to its goal. */
export function objectiveValue(level: LevelData, stats: ObjectiveStats): number {
  switch (level.objective.kind) {
    case 'targets':
    case 'defeat':
      return Math.min(level.objective.count, stats.targetsDefeated)
    case 'material':
      return Math.min(level.objective.count, stats.materialDestroyed[level.objective.material ?? 'wood'] ?? 0)
    case 'score':
      return Math.min(level.objective.count, stats.score)
  }
}

export function objectiveComplete(level: LevelData, stats: ObjectiveStats): boolean {
  if (level.objective.kind === 'score') return stats.score >= level.objective.count
  return objectiveValue(level, stats) >= level.objective.count
}

export function objectiveLabel(level: LevelData): string {
  switch (level.objective.kind) {
    case 'targets':
      return level.objective.count === 1 ? 'Knock out the Grumplet' : `Knock out all ${level.objective.count} Grumplets`
    case 'defeat':
      return `Knock out ${level.objective.count} of ${level.targets.length}`
    case 'material': {
      const name = level.objective.material ?? 'wood'
      return `Smash ${level.objective.count} ${name} blocks`
    }
    case 'score':
      return `Score ${level.objective.count.toLocaleString('en-US')}`
  }
}

export function starThresholds(level: LevelData): [number, number] {
  return level.starShots
}

export function starsFor(level: LevelData, shotsUsed: number): number {
  const [two, three] = level.starShots
  if (shotsUsed <= three) return 3
  if (shotsUsed <= two) return 2
  return 1
}
