import Phaser from 'phaser'
import { sound } from '../core/audio'
import { save } from '../core/saves'
import { buildLevel, LEVELS_PER_WORLD } from '../game/levels'
import { WORLDS } from '../data/worlds'
import { Backdrop } from './Backdrop'
import { button, display, fadeIn, fadeTo, formatNumber, label, starRow } from './common'
import { DESIGN_W, designStage, type Stage } from './layout'

interface Node {
  level: number
  container: Phaser.GameObjects.Container
  y: number
}

/**
 * The Journey map: one world per page, fifty levels along a winding path you
 * drag up and down. Level 1 sits at the bottom of the path and the world boss
 * at the top. Off-screen nodes are hidden, so a fifty-node world is cheap.
 */
export class JourneyScene extends Phaser.Scene {
  private world = 0
  private nodes: Node[] = []
  private path?: Phaser.GameObjects.Container
  private offset = 700
  private dragging = false
  private lastY = 0
  private velocity = 0
  private moved = 0
  private stage!: Stage
  private header!: Phaser.GameObjects.Text
  private subheader!: Phaser.GameObjects.Text
  private backdrop?: Backdrop

  constructor() {
    super('Journey')
  }

  create(): void {
    fadeIn(this)
    this.stage = designStage(this)
    const data = save()
    this.world = Math.max(0, Math.min(9, Math.floor((data.unlocked - 1) / LEVELS_PER_WORLD)))

    this.stage.root.add(
      button(this, 78, 62, '\u2190', () => fadeTo(this, 'Menu'), { width: 84, height: 60, size: 22, fill: '#2f2547' }),
    )
    this.stage.root.add(
      button(this, 140, 62, '\u2039', () => this.switchWorld(-1), { width: 62, height: 60, size: 24, fill: '#2f2547' }),
    )
    this.stage.root.add(
      button(this, 580, 62, '\u203a', () => this.switchWorld(1), { width: 62, height: 60, size: 24, fill: '#2f2547' }),
    )
    this.header = label(this, 360, 42, '', 21, '#ffffff', {
      origin: 0.5,
      fontStyle: 'bold',
      fontFamily: '"Arial Black", sans-serif',
    })
    this.subheader = label(this, 360, 76, '', 12, '#ffe6a8', { origin: 0.5, letterSpacing: 1.1 })
    this.stage.root.add([this.header, this.subheader])
    this.stage.root.add(label(this, DESIGN_W / 2, 1210, 'DRAG TO SCROLL \u00b7 TAP A LEVEL', 11, '#ffffff', { origin: 0.5, alpha: 0.6, letterSpacing: 1 }))

    this.buildWorld(this.world)
    this.bindScroll()
    sound.startMusic('menu')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sound.stopMusic())
  }

  private buildWorld(world: number): void {
    this.world = world
    const data = save()
    const theme = WORLDS[world]!
    this.header.setText(`WORLD ${world + 1} \u00b7 ${theme.name.toUpperCase()}`)
    let worldStars = 0
    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      worldStars += data.journey[String(world * LEVELS_PER_WORLD + index + 1)] ?? 0
    }
    this.subheader.setText(`${theme.tagline}  \u00b7  ${worldStars}/150 stars`)

    this.backdrop?.destroy()
    this.backdrop?.container.destroy(true)
    this.backdrop = new Backdrop(this, theme, { motes: true, dim: 0.22 })
    this.stage.root.addAt(this.backdrop.container, 0)

    this.path?.destroy(true)
    this.nodes = []
    const path = this.add.container(0, 0)
    this.path = path
    this.stage.root.add(path)

    const spacing = 132
    for (let index = 0; index < LEVELS_PER_WORLD; index += 1) {
      const level = world * LEVELS_PER_WORLD + index + 1
      const stars = data.journey[String(level)] ?? 0
      const locked = level > data.unlocked
      const current = level === data.unlocked
      const y = -index * spacing
      const x = DESIGN_W / 2 + Math.sin(index * 0.62) * 165
      const node = this.add.container(x, y)

      const halo = this.add.circle(0, 0, 46, 0xffffff, current ? 0.16 : 0.06)
      const ring = this.add
        .circle(0, 0, 40, locked ? 0x241d38 : stars > 0 ? 0x3a2c5c : 0x2c2344)
        .setStrokeStyle(4, locked ? 0x3a3252 : current ? 0xffe066 : 0x8f7bc4, 1)
      const number = label(this, 0, -6, String(level), 22, locked ? '#6c6390' : '#ffffff', {
        origin: 0.5,
        fontStyle: 'bold',
        fontFamily: '"Arial Black", sans-serif',
      })
      node.add([halo, ring, number])
      if (!locked) node.add(starRow(this, 0, 26, stars, 15, 17))
      if (current) this.tweens.add({ targets: halo, scale: 1.25, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 })
      if (!locked) {
        ring.setInteractive({ useHandCursor: true })
        ring.on('pointerup', () => {
          if (this.moved > 12) return
          this.pick(level)
        })
      }
      path.add(node)
      this.nodes.push({ level, container: node, y })
    }

    const index = Math.max(0, Math.min(LEVELS_PER_WORLD - 1, data.unlocked - 1 - world * LEVELS_PER_WORLD))
    this.offset = Phaser.Math.Clamp(700 + index * spacing, 620, 700 + (LEVELS_PER_WORLD - 1) * spacing)
    path.setY(this.offset)
    this.velocity = 0
    this.cull()
  }

  private switchWorld(direction: number): void {
    const next = Phaser.Math.Clamp(this.world + direction, 0, WORLDS.length - 1)
    if (next === this.world) return
    sound.click()
    this.cameras.main.flash(150, 255, 255, 255, false)
    this.buildWorld(next)
  }

  private pick(level: number): void {
    const data = save()
    if (level > data.unlocked) return
    sound.click()
    const levelData = buildLevel(level)
    const card = this.add.container(0, 0).setDepth(80)
    card.add(this.add.rectangle(DESIGN_W / 2, 640, DESIGN_W, 1280, 0x08060f, 0.72).setInteractive())
    card.add(this.add.rectangle(DESIGN_W / 2, 640, 570, 430, 0x241a38).setStrokeStyle(4, 0x8f7bc4, 1))
    card.add(label(this, DESIGN_W / 2, 486, `LEVEL ${level}`, 16, '#ffe6a8', { origin: 0.5, letterSpacing: 1.4 }))
    card.add(display(this, DESIGN_W / 2, 540, levelData.title.toUpperCase(), 26, '#ffffff'))
    card.add(
      label(this, DESIGN_W / 2, 592, this.objectiveText(levelData.objective.kind, levelData.objective.count, levelData.objective.material), 15, '#ffffff', {
        origin: 0.5,
        alpha: 0.9,
      }),
    )
    card.add(
      label(
        this,
        DESIGN_W / 2,
        628,
        `${levelData.ammo} shots \u00b7 three stars at ${levelData.starShots[1]}`,
        13,
        '#bfe9ff',
        { origin: 0.5 },
      ),
    )
    card.add(starRow(this, DESIGN_W / 2, 674, data.journey[String(level)] ?? 0, 26, 34))
    card.add(
      button(this, DESIGN_W / 2 - 130, 762, 'PLAY', () => fadeTo(this, 'Game', { mode: 'journey', levelId: level }), {
        width: 220,
        height: 78,
      }),
    )
    card.add(
      button(this, DESIGN_W / 2 + 130, 762, 'BACK', () => card.destroy(true), { width: 220, height: 78, fill: '#38283f' }),
    )
  }

  private objectiveText(kind: string, count: number, material?: string): string {
    if (kind === 'targets') return `Knock out all ${count} Grumplets`
    if (kind === 'defeat') return `Knock out ${count} Grumplets`
    if (kind === 'material') return `Smash ${count} ${material} blocks`
    return `Score ${formatNumber(count)}`
  }

  private bindScroll(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 108) return
      this.dragging = true
      this.lastY = pointer.worldY
      this.moved = 0
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return
      const delta = pointer.worldY - this.lastY
      this.lastY = pointer.worldY
      this.moved += Math.abs(delta)
      this.offset += delta
      this.velocity = delta
    })
    this.input.on('pointerup', () => {
      this.dragging = false
    })
  }

  private cull(): void {
    for (const node of this.nodes) {
      const screenY = node.y + this.offset
      const visible = screenY > 120 && screenY < 1180
      node.container.setVisible(visible)
      node.container.setActive(visible)
    }
  }

  override update(): void {
    if (!this.dragging && Math.abs(this.velocity) > 0.05) {
      this.offset += this.velocity
      this.velocity *= 0.88
      if (Math.abs(this.velocity) < 0.05) this.velocity = 0
    }
    this.offset = Phaser.Math.Clamp(this.offset, 600, 700 + (LEVELS_PER_WORLD - 1) * 132)
    if (this.path) {
      this.path.setY(this.offset)
      this.cull()
    }
  }
}
