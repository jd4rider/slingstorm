import Phaser from 'phaser'
import { sound } from '../core/audio'
import { ACHIEVEMENTS, save, update } from '../core/saves'
import { WORLDS } from '../data/worlds'
import { PROJECTILES } from '../game/projectiles'
import { ABILITY_LABEL } from '../game/projectiles'
import { Backdrop } from './Backdrop'
import { button, display, fadeIn, fadeTo, formatDuration, formatNumber, label } from './common'
import { DESIGN_H, DESIGN_W, designStage } from './layout'
import { SLINGLING_KEYS } from './art'

type Tab = 'roster' | 'trophies' | 'stats'

/** Slingling collection, achievements and lifetime statistics in one screen. */
export class CollectionScene extends Phaser.Scene {
  private tab: Tab = 'roster'
  private body!: Phaser.GameObjects.Container

  constructor() {
    super('Collection')
  }

  create(): void {
    fadeIn(this)
    const stage = designStage(this)
    const backdrop = new Backdrop(this, WORLDS[0]!, { motes: false, dim: 0.35 })
    stage.root.add(backdrop.container)
    stage.root.add(button(this, 78, 62, '\u2190', () => fadeTo(this, 'Menu'), { width: 84, height: 60, size: 22, fill: '#2f2547' }))
    stage.root.add(display(this, DESIGN_W / 2, 62, 'COLLECTION', 26, '#ffffff'))

    const tabs: Array<[Tab, string]> = [
      ['roster', 'SLINGLINGS'],
      ['trophies', 'TROPHIES'],
      ['stats', 'STATS'],
    ]
    tabs.forEach(([tab, title], index) => {
      const x = DESIGN_W / 2 + (index - 1) * 216
      stage.root.add(
        button(this, x, 148, title, () => this.select(tab), {
          width: 200,
          height: 62,
          size: 16,
          fill: this.tab === tab ? '#4b3a75' : '#2f2547',
        }),
      )
    })

    this.body = this.add.container(0, 0)
    stage.root.add(this.body)
    this.render()
    void DESIGN_H
  }

  private select(tab: Tab): void {
    if (tab === this.tab) return
    sound.click()
    this.tab = tab
    this.scene.restart()
  }

  private render(): void {
    this.body.removeAll(true)
    if (this.tab === 'roster') this.renderRoster()
    if (this.tab === 'trophies') this.renderTrophies()
    if (this.tab === 'stats') this.renderStats()
  }

  private renderRoster(): void {
    const keys = SLINGLING_KEYS as readonly (keyof typeof PROJECTILES)[]
    keys.forEach((key, index) => {
      const def = PROJECTILES[key]
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = 194 + column * 332
      const y = 300 + row * 158
      const card = this.add.container(x, y)
      card.add(this.add.rectangle(0, 0, 300, 138, 0x241a38, 0.94).setStrokeStyle(3, 0x8f7bc4, 1))
      const sprite = this.add.sprite(-100, 0, `sling-${key}-idle`).setScale(0.62)
      if (this.anims.exists(`sling-${key}-idle`)) sprite.play(`sling-${key}-idle`)
      card.add(sprite)
      card.add(label(this, -58, -50, def.name.toUpperCase(), 15, '#ffffff', { fontStyle: 'bold' }))
      card.add(label(this, -58, -22, ABILITY_LABEL[def.ability], 12, '#bfe9ff'))
      card.add(label(this, -58, 6, def.blurb, 10, '#cfc6e6', { wrap: 230, lineSpacing: 2, alpha: 0.9 }))
      card.add(label(this, -58, 52, `Radius ${def.radius} \u00b7 Damage ${def.damageMul.toFixed(2)}x`, 10, '#8f7bc4'))
      this.body.add(card)
    })
  }

  private renderTrophies(): void {
    const data = save()
    ACHIEVEMENTS.forEach((achievement, index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = 194 + column * 332
      const y = 268 + row * 88
      const earned = data.achievements.includes(achievement.id)
      const card = this.add.container(x, y)
      card.add(
        this.add
          .rectangle(0, 0, 300, 74, earned ? 0x2f2a4e : 0x201a33, 0.94)
          .setStrokeStyle(2, earned ? 0xffd85c : 0x4a3f66, 1),
      )
      card.add(label(this, -132, -24, earned ? '\u2605' : '\u2606', 18, earned ? '#ffd85c' : '#6c6390'))
      card.add(label(this, -104, -24, achievement.name, 13, earned ? '#ffffff' : '#9c92bd', { fontStyle: 'bold' }))
      card.add(label(this, -132, 2, achievement.hint, 10, '#cfc6e6', { wrap: 268, alpha: 0.85 }))
      this.body.add(card)
    })
  }

  private renderStats(): void {
    const data = save()
    const stats: Array<[string, string]> = [
      ['Shots fired', formatNumber(data.stats.shots)],
      ['Towers cleared', formatNumber(data.stats.towers)],
      ['Grumplets knocked out', formatNumber(data.stats.targets)],
      ['Blocks destroyed', formatNumber(data.stats.blocks)],
      ['Wood / glass / stone', `${formatNumber(data.stats.wood)} / ${formatNumber(data.stats.glass)} / ${formatNumber(data.stats.stone)}`],
      ['Boom crates detonated', formatNumber(data.stats.crates)],
      ['Best combo', `${data.stats.bestCombo}x`],
      ['Three-star levels', formatNumber(data.stats.perfect)],
      ['Journey stars', formatNumber(data.stats.journeyStars)],
      ['Best Endless score', formatNumber(data.endlessBest)],
      ['Best Blitz score', formatNumber(data.blitzBest)],
      ['Total playtime', formatDuration(data.stats.playMs)],
    ]
    const card = this.add.container(DESIGN_W / 2, 620)
    card.add(this.add.rectangle(0, 0, 580, 600, 0x241a38, 0.94).setStrokeStyle(3, 0x8f7bc4, 1))
    stats.forEach(([key, value], index) => {
      const y = -270 + index * 46
      card.add(label(this, -250, y, key, 15, '#cfc6e6'))
      card.add(label(this, 250, y, value, 16, '#ffffff', { origin: [1, 0], fontStyle: 'bold' }))
    })
    this.body.add(card)
    this.body.add(
      button(
        this,
        DESIGN_W / 2,
        980,
        'RESET STATISTICS',
        () => {
          update((current) => {
            current.stats = {
              shots: 0,
              towers: 0,
              targets: 0,
              blocks: 0,
              bestCombo: 0,
              journeyStars: current.stats.journeyStars,
              perfect: 0,
              abilities: 0,
              playMs: 0,
              endlessBest: 0,
              blitzBest: 0,
              wood: 0,
              glass: 0,
              stone: 0,
              crates: 0,
            }
          })
          this.scene.restart()
        },
        { width: 380, height: 72, fill: '#4a2b38', size: 16 },
      ),
    )
  }
}
