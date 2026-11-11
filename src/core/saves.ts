/**
 * Versioned local save. Everything is validated on read: a corrupt or older
 * payload falls back to defaults instead of throwing away a player's Journey.
 * The arcade client mirrors these same keys into an account when signed in.
 */

export const SAVE_KEY = 'slingstorm-save-v1'
export const TOTAL_LEVELS = 500

export type Quality = 'low' | 'medium' | 'high'

export interface Settings {
  sfx: number
  music: number
  muted: boolean
  quality: Quality
  reducedMotion: boolean
  shake: boolean
  /** 0 full, 1 short, 2 minimal, 3 off. */
  guide: number
}

export interface Stats {
  shots: number
  towers: number
  targets: number
  blocks: number
  bestCombo: number
  journeyStars: number
  perfect: number
  abilities: number
  playMs: number
  endlessBest: number
  blitzBest: number
  wood: number
  glass: number
  stone: number
  crates: number
}

export interface SaveData {
  version: number
  journey: Record<string, number>
  unlocked: number
  endlessBest: number
  blitzBest: number
  zenBest: number
  dailyBest: number
  achievements: string[]
  stats: Stats
  settings: Settings
  daily: { date: string; done: boolean }
  skins: string[]
  skin: string
  trail: string
}

export const DEFAULT_SETTINGS: Settings = {
  sfx: 0.7,
  music: 0.35,
  muted: false,
  quality: 'high',
  reducedMotion: false,
  shake: true,
  guide: 0,
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    journey: {},
    unlocked: 1,
    endlessBest: 0,
    blitzBest: 0,
    zenBest: 0,
    dailyBest: 0,
    achievements: [],
    stats: {
      shots: 0,
      towers: 0,
      targets: 0,
      blocks: 0,
      bestCombo: 0,
      journeyStars: 0,
      perfect: 0,
      abilities: 0,
      playMs: 0,
      endlessBest: 0,
      blitzBest: 0,
      wood: 0,
      glass: 0,
      stone: 0,
      crates: 0,
    },
    settings: { ...DEFAULT_SETTINGS },
    daily: { date: '', done: false },
    skins: ['classic'],
    skin: 'classic',
    trail: 'sparkle',
  }
}

function number(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function quality(value: unknown): Quality {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'high'
}

export function sanitize(raw: unknown): SaveData {
  const base = defaultSave()
  if (!raw || typeof raw !== 'object') return base
  const data = raw as Partial<SaveData>
  const journey: Record<string, number> = {}
  if (data.journey && typeof data.journey === 'object') {
    for (const [key, value] of Object.entries(data.journey)) {
      const id = Number(key)
      if (!Number.isInteger(id) || id < 1 || id > TOTAL_LEVELS) continue
      journey[key] = number(value, 0, 0, 3)
    }
  }
  const achievements = Array.isArray(data.achievements)
    ? data.achievements.filter((item): item is string => typeof item === 'string').slice(0, 64)
    : []
  const stats = (data.stats ?? {}) as Partial<Stats>
  const settings = (data.settings ?? {}) as Partial<Settings>
  const skins = Array.isArray(data.skins)
    ? data.skins.filter((item): item is string => typeof item === 'string').slice(0, 16)
    : base.skins
  return {
    version: 1,
    journey,
    unlocked: number(data.unlocked, 1, 1, TOTAL_LEVELS),
    endlessBest: number(data.endlessBest, 0),
    blitzBest: number(data.blitzBest, 0),
    zenBest: number(data.zenBest, 0),
    dailyBest: number(data.dailyBest, 0),
    achievements,
    stats: {
      shots: number(stats.shots, 0),
      towers: number(stats.towers, 0),
      targets: number(stats.targets, 0),
      blocks: number(stats.blocks, 0),
      bestCombo: number(stats.bestCombo, 0),
      journeyStars: number(stats.journeyStars, 0),
      perfect: number(stats.perfect, 0),
      abilities: number(stats.abilities, 0),
      playMs: number(stats.playMs, 0),
      endlessBest: number(stats.endlessBest, 0),
      blitzBest: number(stats.blitzBest, 0),
      wood: number(stats.wood, 0),
      glass: number(stats.glass, 0),
      stone: number(stats.stone, 0),
      crates: number(stats.crates, 0),
    },
    settings: {
      sfx: number(settings.sfx, DEFAULT_SETTINGS.sfx, 0, 1),
      music: number(settings.music, DEFAULT_SETTINGS.music, 0, 1),
      muted: Boolean(settings.muted),
      quality: quality(settings.quality),
      reducedMotion: Boolean(settings.reducedMotion),
      shake: settings.shake === undefined ? true : Boolean(settings.shake),
      guide: number(settings.guide, 0, 0, 3),
    },
    daily: {
      date: typeof data.daily?.date === 'string' ? data.daily.date : '',
      done: Boolean(data.daily?.done),
    },
    skins: skins.length > 0 ? skins : base.skins,
    skin: typeof data.skin === 'string' && skins.includes(data.skin) ? data.skin : 'classic',
    trail: typeof data.trail === 'string' ? data.trail : 'sparkle',
  }
}

export function loadSave(): SaveData {
  if (typeof localStorage === 'undefined') return defaultSave()
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return defaultSave()
    return sanitize(JSON.parse(raw))
  } catch {
    return defaultSave()
  }
}

let cache: SaveData | null = null

export function save(): SaveData {
  if (!cache) cache = loadSave()
  return cache
}

export function persist(next: SaveData): void {
  cache = next
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next))
  } catch {
    // Private-mode storage can be unavailable; the in-memory copy still works.
  }
}

export function update(mutate: (data: SaveData) => void): SaveData {
  const next = sanitize(structuredClone(save()))
  mutate(next)
  persist(next)
  return next
}

export function totalStars(data: SaveData = save()): number {
  return Object.values(data.journey).reduce((sum, stars) => sum + stars, 0)
}

export interface LevelRecord {
  stars: number
  score: number
  shots: number
  levelId: number
}

export function recordLevel(record: LevelRecord): SaveData {
  return update((data) => {
    const key = String(record.levelId)
    data.journey[key] = Math.max(data.journey[key] ?? 0, Math.min(3, Math.max(1, record.stars)))
    if (record.levelId === data.unlocked) data.unlocked = Math.min(TOTAL_LEVELS, record.levelId + 1)
    data.stats.journeyStars = totalStars(data)
    data.stats.perfect += record.stars >= 3 ? 1 : 0
    data.stats.towers += 1
    void record.score
    void record.shots
  })
}

export interface RunStats {
  shots: number
  targets: number
  blocks: number
  bestCombo: number
  playMs: number
  materials: Record<string, number>
}

export function recordRun(mode: 'endless' | 'blitz' | 'zen' | 'daily', score: number, stats: RunStats): SaveData {
  return update((data) => {
    if (mode === 'endless') data.endlessBest = Math.max(data.endlessBest, score)
    if (mode === 'blitz') data.blitzBest = Math.max(data.blitzBest, score)
    if (mode === 'zen') data.zenBest = Math.max(data.zenBest, score)
    if (mode === 'daily') data.dailyBest = Math.max(data.dailyBest, score)
    data.stats.shots += stats.shots
    data.stats.targets += stats.targets
    data.stats.blocks += stats.blocks
    data.stats.bestCombo = Math.max(data.stats.bestCombo, stats.bestCombo)
    data.stats.playMs += stats.playMs
    data.stats.wood += stats.materials.wood ?? 0
    data.stats.glass += stats.materials.glass ?? 0
    data.stats.stone += stats.materials.stone ?? 0
    data.stats.crates += stats.materials.crate ?? 0
    data.stats.endlessBest = Math.max(data.stats.endlessBest, data.endlessBest)
    data.stats.blitzBest = Math.max(data.stats.blitzBest, data.blitzBest)
  })
}

export interface Achievement {
  id: string
  name: string
  hint: string
  earned: (data: SaveData) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-launch', name: 'First Launch', hint: 'Fire your first Slingling', earned: (d) => d.stats.shots >= 1 },
  { id: 'tower-down', name: 'Tower Down', hint: 'Clear your first tower', earned: (d) => d.stats.towers >= 1 },
  { id: 'perfect', name: 'Perfect Shot', hint: 'Earn three stars on a level', earned: (d) => d.stats.perfect >= 1 },
  { id: 'wood', name: 'Wood Breaker', hint: 'Smash 100 wood blocks', earned: (d) => d.stats.wood >= 100 },
  { id: 'glass', name: 'Glass Shatterer', hint: 'Shatter 100 glass blocks', earned: (d) => d.stats.glass >= 100 },
  { id: 'stone', name: 'Stone Cracker', hint: 'Break 50 stone blocks', earned: (d) => d.stats.stone >= 50 },
  { id: 'explosive', name: 'Explosive Genius', hint: 'Detonate 50 boom crates', earned: (d) => d.stats.crates >= 50 },
  { id: 'combo', name: 'Chain Reaction', hint: 'Reach a five-event combo', earned: (d) => d.stats.bestCombo >= 5 },
  { id: 'storm', name: 'Storm Combo Master', hint: 'Reach an eight-event combo', earned: (d) => d.stats.bestCombo >= 8 },
  { id: 'precision', name: 'Precision Master', hint: 'Earn 10 three-star levels', earned: (d) => d.stats.perfect >= 10 },
  { id: 'explorer', name: 'World Champion', hint: 'Clear 50 Journey levels', earned: (d) => Object.keys(d.journey).length >= 50 },
  { id: 'siege', name: 'Ultimate Siege', hint: 'Reach stage 10 in Endless Siege', earned: (d) => d.stats.endlessBest >= 25000 },
]

export function syncAchievements(): string[] {
  const data = save()
  const earned = ACHIEVEMENTS.filter((achievement) => achievement.earned(data)).map((achievement) => achievement.id)
  const fresh = earned.filter((id) => !data.achievements.includes(id))
  if (fresh.length > 0) {
    update((current) => {
      current.achievements = [...new Set([...current.achievements, ...earned])]
    })
  }
  return fresh
}

export function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function dailySeed(date = todayKey()): number {
  let hash = 2166136261
  for (let index = 0; index < date.length; index += 1) {
    hash ^= date.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
