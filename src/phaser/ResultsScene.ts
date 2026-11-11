import Phaser from 'phaser'
import { sound } from '../core/audio'
import { recordLevel, recordRun, syncAchievements } from '../core/saves'
import { buildLevel } from '../game/levels'
import { WORLDS } from '../data/worlds'
import type { RunSummary } from '../game/types'
import { Backdrop } from './Backdrop'
import { button, display, fadeIn, fadeTo, formatDuration, formatNumber, label, starRow } from './common'
import { DESIGN_H, DESIGN_W, designStage } from './layout'
import { arcade } from '../integration/LittleJoyAdapter'

export class ResultsScene extends Phaser.Scene {
  private payload!: RunSummary

  constructor() {
    super('Results')
  }

  create(data: RunSummary): void {
    fadeIn(this)
    this.payload = data
    const stage = designStage(this)
    const world = WORLDS[Math.max(0, Math.min(WORLDS.length - 1, data.world))]!
    const backdrop = new Backdrop(this, world, { dim: data.won ? 0.3 : 0.5 })
    stage.root.add(backdrop.container)

    this.persist(data)

    const level = data.mode === 'journey' || data.mode === 'precision' ? buildLevel(data.levelId ?? 1) : undefined
    stage.root.add(
      label(this, DESIGN_W / 2, 92, level ? `WORLD ${level.world + 1} \u00b7 LEVEL ${level.id}` : this.modeName(data.mode), 12, '#ffe6a8', {
        origin: 0.5,
        letterSpacing: 1.6,
        fontStyle: 'bold',
      }),
    )
    stage.root.add(
      display(this, DESIGN_W / 2, 150, data.won ? (data.mode === 'journey' ? 'TOWER DOWN!' : 'RUN COMPLETE') : 'OUT OF AMMO', 40, '#ffffff'),
    )
    stage.root.add(
      label(this, DESIGN_W / 2, 196, data.won ? 'Beautiful demolition' : 'The tower is still standing', 14, '#ffffff', {
        origin: 0.5,
        alpha: 0.82,
      }),
    )
    stage.root.add(starRow(this, DESIGN_W / 2, 262, data.stars, 40, 58))

    const rows: Array<[string, string]> = [
      ['Score', formatNumber(data.score)],
      ['Grumplets knocked out', `${data.targetsDefeated} / ${data.targetsTotal}`],
      ['Blocks destroyed', formatNumber(data.blocksDestroyed)],
      ['Best combo', `${data.bestCombo}x`],
      ['Shots used', `${data.shotsUsed} of ${data.ammo}`],
      ['Time', formatDuration(data.elapsedMs)],
    ]
    const card = this.add.container(DESIGN_W / 2, 470)
    card.add(this.add.rectangle(0, 0, 580, 300, 0x241a38, 0.94).setStrokeStyle(3, 0x8f7bc4, 1))
    rows.forEach(([key, value], index) => {
      const y = -110 + index * 44
      card.add(label(this, -250, y, key, 15, '#cfc6e6'))
      card.add(label(this, 250, y, value, 17, '#ffffff', { origin: [1, 0], fontStyle: 'bold' }))
    })
    stage.root.add(card)

    const next = this.nextAction()
    stage.root.add(
      button(this, DESIGN_W / 2, 700, next.label, next.action, { width: 420, height: 88, fill: '#3b2f5e' }),
    )
    stage.root.add(
      button(this, DESIGN_W / 2, 802, 'REPLAY', () => this.replay(), { width: 420, height: 78, fill: '#38283f' }),
    )
    stage.root.add(
      button(this, DESIGN_W / 2 - 115, 896, 'JOURNEY', () => fadeTo(this, 'Journey'), { width: 210, height: 70, size: 18, fill: '#2f2547' }),
    )
    stage.root.add(
      button(this, DESIGN_W / 2 + 115, 896, 'MENU', () => fadeTo(this, 'Menu'), { width: 210, height: 70, size: 18, fill: '#2f2547' }),
    )
    if (data.won) sound.star()
    void DESIGN_H
  }

  private persist(data: RunSummary): void {
    if ((data.mode === 'journey' || data.mode === 'precision') && data.won) {
      recordLevel({ levelId: data.levelId ?? 1, stars: data.stars, score: data.score, shots: data.shotsUsed })
      syncAchievements()
      void arcade.sync()
      return
    }
    if (data.mode === 'journey' || data.mode === 'precision') return
    const mode = data.mode === 'endless' ? 'endless' : data.mode === 'blitz' ? 'blitz' : data.mode === 'daily' ? 'daily' : 'zen'
    recordRun(mode, data.score, {
      shots: data.shotsUsed,
      targets: data.targetsDefeated,
      blocks: data.blocksDestroyed,
      bestCombo: data.bestCombo,
      playMs: data.elapsedMs,
      materials: {},
    })
    syncAchievements()
    void arcade.sync()
  }

  private nextAction(): { label: string; action: () => void } {
    const data = this.payload
    if ((data.mode === 'journey' || data.mode === 'precision') && data.won && (data.levelId ?? 0) < 500) {
      return {
        label: 'NEXT LEVEL',
        action: () => fadeTo(this, 'Game', { mode: data.mode, levelId: (data.levelId ?? 1) + 1 }),
      }
    }
    if (data.mode === 'endless' || data.mode === 'blitz' || data.mode === 'zen') {
      return { label: 'PLAY AGAIN', action: () => fadeTo(this, 'Game', { mode: data.mode, seed: 7 }) }
    }
    return { label: 'TRY AGAIN', action: () => this.replay() }
  }

  private replay(): void {
    const data = this.payload
    if (data.mode === 'journey' || data.mode === 'precision') {
      fadeTo(this, 'Game', { mode: data.mode, levelId: data.levelId ?? 1 })
      return
    }
    fadeTo(this, 'Game', { mode: data.mode, seed: 7 })
  }

  private modeName(mode: RunSummary['mode']): string {
    const names: Record<RunSummary['mode'], string> = {
      journey: 'PUZZLE JOURNEY',
      endless: 'ENDLESS SIEGE',
      blitz: 'DESTRUCTION BLITZ',
      precision: 'PRECISION CHALLENGE',
      zen: 'ZEN DEMOLITION',
      daily: 'DAILY SIEGE',
    }
    return names[mode]
  }
}

