import Phaser from 'phaser'
import { sound } from '../core/audio'
import { save, syncAchievements } from '../core/saves'
import { buildArena, buildLevel, levelObjectiveText } from '../game/levels'
import { GROUND, GROUND_Y, SLING, SUBSTEPS, SUBSTEP_MS } from '../game/config'
import { damageFor, impactEnergy } from '../game/damage'
import { materialDef } from '../game/materials'
import { objectiveComplete, objectiveValue, starsFor } from '../game/progress'
import { projectileDef } from '../game/projectiles'
import {
  blockScore,
  comboWord,
  FEVER_CHARGE,
  FEVER_SECONDS,
  feverChargeFor,
  targetScore,
  unusedShotScore,
} from '../game/scoring'
import { firstIntersection, predictPath, pullPower, pullToVelocity } from '../game/trajectory'
import type {
  BlockSpec,
  GameMode,
  LevelData,
  ObjectiveStats,
  ProjectileId,
  RunSummary,
  TargetSpec,
  Vec2,
} from '../game/types'
import { worldDef, type WorldDef } from '../data/worlds'
import { Backdrop } from './Backdrop'
import { button, display, formatNumber, hex, label, panel } from './common'
import { DESIGN_H, DESIGN_W } from './layout'

type Body = MatterJS.BodyType

export interface GamePayload {
  mode: GameMode
  levelId?: number
  stage?: number
  seed?: number
}

interface BlockRuntime {
  spec: BlockSpec
  body: Body
  tile: Phaser.GameObjects.TileSprite
  outline: Phaser.GameObjects.Rectangle
  crack: Phaser.GameObjects.Image
  health: number
  maxHealth: number
  destroyed: boolean
  frozenUntil: number
}

interface TargetRuntime {
  spec: TargetSpec
  body: Body
  sprite: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  defeated: boolean
  health: number
}

interface ShipRuntime {
  type: ProjectileId
  body: Body
  sprite: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Ellipse
  abilityUsed: boolean
  damageMul: number
  age: number
  trailMs: number
}

interface Impact {
  a: number
  b: number
  speed: number
  x: number
  y: number
}

const TARGET_HEALTH = 90
const TARGET_TOUGHNESS = 12
const BLAST_RADIUS = 118
const BLAST_POWER = 900
const MAX_EXPLOSIONS = 14
const AMMO_BLUE = '#ffd27a'

export class GameScene extends Phaser.Scene {
  private payload: GamePayload = { mode: 'journey', levelId: 1 }
  private mode: GameMode = 'journey'
  private level!: LevelData
  private world!: WorldDef
  private backdrop?: Backdrop

  private blocks: BlockRuntime[] = []
  private targets: TargetRuntime[] = []
  private ships: ShipRuntime[] = []
  private blockByBody = new Map<number, BlockRuntime>()
  private targetByBody = new Map<number, TargetRuntime>()
  private shipByBody = new Map<number, ShipRuntime>()

  private loaded?: Phaser.GameObjects.Sprite
  private loadedShadow?: Phaser.GameObjects.Ellipse
  private currentType: ProjectileId = 'pippin'
  private queue: ProjectileId[] = []
  private ammoTotal = 0
  private ammoUsed = 0

  private phase: 'aim' | 'flight' | 'settle' | 'done' | 'paused' = 'aim'
  private aiming = false
  private aimPull: Vec2 = { x: 0, y: 0 }
  /** Keyboard aim in degrees above the horizontal: 0 is a flat shot right. */
  private keyAngle = 24
  private keyPower = 0.7
  private lastSoundPull = 0

  private score = 0
  private chain = 0
  private bestCombo = 0
  private targetsDefeated = 0
  private blocksDestroyed = 0
  private materialDestroyed: Record<string, number> = {}
  private feverCharge = 0
  private feverMs = 0
  private stage = 1
  private elapsedMs = 0
  private blitzLeft = 120_000
  private shotAge = 0
  private settleMs = 0
  private damages: Impact[] = []
  private explosions = 0
  private finishing = false

  private bands!: Phaser.GameObjects.Graphics
  private preview!: Phaser.GameObjects.Graphics
  private slingArt!: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics
  private cliffArt!: Phaser.GameObjects.Graphics
  private hud!: Phaser.GameObjects.Container
  private hudObjective!: Phaser.GameObjects.Text
  private hudProgress!: Phaser.GameObjects.Text
  private hudProgressBar!: Phaser.GameObjects.Graphics
  private hudScore!: Phaser.GameObjects.Text
  private hudAmmo!: Phaser.GameObjects.Text
  private hudShip!: Phaser.GameObjects.Text
  private hudAbility!: Phaser.GameObjects.Text
  private feverBar!: Phaser.GameObjects.Graphics
  private comboText?: Phaser.GameObjects.Text
  private pauseLayer?: Phaser.GameObjects.Container
  private bannerText?: Phaser.GameObjects.Text

  private dust!: Phaser.GameObjects.Particles.ParticleEmitter
  private shards!: Phaser.GameObjects.Particles.ParticleEmitter
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter
  private stars!: Phaser.GameObjects.Particles.ParticleEmitter

  constructor() {
    super('Game')
  }

  create(data: GamePayload): void {
    this.payload = data ?? { mode: 'journey', levelId: 1 }
    this.mode = this.payload.mode
    this.stage = this.payload.stage ?? 1
    this.score = 0
    this.bestCombo = 0
    this.targetsDefeated = 0
    this.blocksDestroyed = 0
    this.materialDestroyed = {}
    this.feverCharge = 0
    this.feverMs = 0
    this.elapsedMs = 0
    this.blitzLeft = 120_000
    this.finishing = false

    this.cameras.main.setBackgroundColor('#120d1e')
    this.fitCamera()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this)
    this.matter.world.autoUpdate = false
    this.matter.world.setBounds(-2000, -3000, 4720, 6000, 64, true, true, false, false)
    // The ridge never moves, so it is one body for the whole scene.
    this.matter.add.rectangle(GROUND.x + GROUND.w / 2, GROUND.y + GROUND.h / 2, GROUND.w, GROUND.h, {
      isStatic: true,
      friction: 0.95,
      frictionStatic: 1,
      restitution: 0,
      label: 'ground',
    })

    this.bands = this.add.graphics().setDepth(14)
    this.preview = this.add.graphics().setDepth(13)
    this.cliffArt = this.add.graphics().setDepth(6)

    this.createEmitters()
    this.buildHud()
    this.bindInput()
    this.beginStage(this.stage)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this)
      if (this.matter && this.matter.world) this.matter.world.off('collisionstart', this.onCollision, this)
      if (typeof document !== 'undefined') document.body.classList.remove('ss-playing')
    })
    this.matter.world.on('collisionstart', this.onCollision, this)

    if (typeof document !== 'undefined') document.body.classList.add('ss-playing')
    this.cameras.main.fadeIn(220, 10, 8, 20)
    sound.startMusic(this.mode === 'zen' ? 'zen' : 'play')
  }

  private fitCamera(): void {
    const zoom = Math.min(this.scale.width / DESIGN_W, this.scale.height / DESIGN_H)
    const camera = this.cameras.main
    camera.setZoom(zoom)
    camera.centerOn(DESIGN_W / 2, DESIGN_H / 2)
  }

  // ---------------------------------------------------------------- stage setup

  private beginStage(stage: number): void {
    this.clearStage()
    this.stage = stage
    this.level = this.makeLevel(stage)
    this.world = worldDef(this.level.world)
    this.backdrop = new Backdrop(this, this.world, { motes: true, dim: 0.06 })
    this.backdrop.container.setDepth(0)
    this.drawGround()
    this.drawSling()
    this.queue = this.expandShots(this.level)
    this.ammoTotal = this.queue.length
    this.ammoUsed = 0
    this.shotAge = 0
    this.settleMs = 0
    this.chain = 0
    this.spawnBlocks()
    this.spawnTargets()
    this.phase = 'aim'
    this.finishing = false
    this.refreshHud()
    this.loadNext()
    this.cameras.main.flash(180, 255, 240, 210, false)
  }

  private makeLevel(stage: number): LevelData {
    if (this.mode === 'journey') return buildLevel(this.payload.levelId ?? 1)
    if (this.mode === 'precision') {
      const level = buildLevel(this.payload.levelId ?? 1)
      return { ...level, ammo: Math.max(1, level.targets.length), starShots: [level.targets.length, level.targets.length] }
    }
    if (this.mode === 'daily') {
      const seed = this.payload.seed ?? 1
      return buildArena(seed, seed % 10, 0.35 + ((seed % 100) / 100) * 0.4)
    }
    // Endless / Blitz / Zen: a deterministic ladder of generated towers.
    const seed = (this.payload.seed ?? 7) + stage * 137
    return buildLevel(((seed * 31) % 500) + 1)
  }

  private expandShots(level: LevelData): ProjectileId[] {
    if (this.mode === 'zen') {
      const queue: ProjectileId[] = []
      for (let index = 0; index < 99; index += 1) queue.push(index % 4 === 3 ? 'boomkin' : 'pippin')
      return queue
    }
    const queue: ProjectileId[] = []
    for (const shot of level.shots) {
      for (let index = 0; index < shot.count; index += 1) queue.push(shot.type)
    }
    while (queue.length < level.ammo) queue.push('pippin')
    if (this.mode === 'precision') return queue.slice(0, Math.max(1, level.targets.length))
    return queue
  }

  private clearStage(): void {
    this.backdrop?.destroy()
    this.backdrop?.container.destroy(true)
    this.backdrop = undefined
    for (const block of this.blocks) {
      this.matter.world.remove(block.body)
      block.tile.destroy()
      block.outline.destroy()
      block.crack.destroy()
    }
    for (const target of this.targets) {
      this.matter.world.remove(target.body)
      target.sprite.destroy()
      target.shadow.destroy()
    }
    for (const ship of this.ships) {
      this.matter.world.remove(ship.body)
      ship.sprite.destroy()
      ship.shadow.destroy()
    }
    this.blocks = []
    this.targets = []
    this.ships = []
    this.blockByBody.clear()
    this.targetByBody.clear()
    this.shipByBody.clear()
    this.damages.length = 0
    this.explosions = 0
    this.loaded?.destroy()
    this.loadedShadow?.destroy()
    this.loaded = undefined
    this.loadedShadow = undefined
  }

  private drawGround(): void {
    const graphics = this.cliffArt
    graphics.clear()
    const near = hex(this.world.near)
    const far = hex(this.world.far)
    // One long ridge: a lit lip over a deep band of striated rock, so the
    // slingshot and every tower are visibly standing on the same ground.
    graphics.fillStyle(far, 1)
    graphics.fillRect(0, GROUND_Y, DESIGN_W, DESIGN_H - GROUND_Y)
    graphics.lineStyle(2, 0x000000, 0.12)
    for (let row = 0; row < 5; row += 1) {
      const y = GROUND_Y + 58 + row * 74
      graphics.beginPath()
      graphics.moveTo(0, y)
      graphics.lineTo(DESIGN_W, y + 18)
      graphics.strokePath()
    }
    graphics.fillStyle(0x000000, 0.18)
    graphics.fillRect(0, GROUND_Y, DESIGN_W, 16)
    graphics.fillStyle(near, 1)
    graphics.fillRoundedRect(-8, GROUND_Y - 8, DESIGN_W + 16, 34, 12)
    graphics.fillStyle(0xffffff, 0.14)
    graphics.fillRoundedRect(-8, GROUND_Y - 8, DESIGN_W + 16, 10, 6)
  }

  private drawSling(): void {
    this.slingArt?.destroy()
    if (this.textures.exists('slingshot')) {
      this.slingArt = this.add.image(SLING.x, GROUND_Y - 92, 'slingshot').setDepth(8).setScale(0.86)
      this.slingArt.setAlpha(0.98)
    } else {
      const graphics = this.add.graphics().setDepth(8)
      graphics.fillStyle(0x8d5427, 1)
      graphics.fillRoundedRect(SLING.x - 18, GROUND_Y - 214, 36, 214, 14)
      graphics.fillStyle(0xc98a4e, 1)
      graphics.fillRoundedRect(SLING.x - 10, GROUND_Y - 214, 12, 214, 8)
      graphics.lineStyle(22, 0x8d5427, 1)
      graphics.lineBetween(SLING.x - 6, GROUND_Y - 178, SLING.leftTip.x, SLING.leftTip.y)
      graphics.lineBetween(SLING.x + 6, GROUND_Y - 178, SLING.rightTip.x, SLING.rightTip.y)
      this.slingArt = graphics
    }
  }

  private spawnBlocks(): void {
    for (const spec of this.level.blocks) {
      const def = materialDef(spec.material)
      const body = this.matter.add.rectangle(spec.x, spec.y, spec.w, spec.h, {
        isStatic: Boolean(spec.fixed),
        angle: spec.angle ?? 0,
        density: def.density,
        friction: def.friction,
        frictionStatic: def.frictionStatic,
        restitution: def.restitution,
        sleepThreshold: 45,
        slop: 0.02,
        label: `block:${spec.id}`,
      })
      const tile = this.add
        .tileSprite(spec.x, spec.y, spec.w, spec.h, `block-${spec.material}`)
        .setDepth(10)
        .setOrigin(0.5)
      const outline = this.add
        .rectangle(spec.x, spec.y, spec.w, spec.h)
        .setStrokeStyle(2, def.edge, 0.85)
        .setDepth(11)
      const crack = this.add
        .image(spec.x, spec.y, 'crack-1')
        .setDisplaySize(spec.w, spec.h)
        .setDepth(12)
        .setAlpha(0)
      if (spec.fixed) {
        tile.setAlpha(0.9)
        outline.setStrokeStyle(3, def.edge, 1)
      }
      const runtime: BlockRuntime = {
        spec,
        body,
        tile,
        outline,
        crack,
        health: def.health,
        maxHealth: def.health,
        destroyed: false,
        frozenUntil: 0,
      }
      this.blocks.push(runtime)
      this.blockByBody.set(body.id, runtime)
    }
  }

  private spawnTargets(): void {
    for (const spec of this.level.targets) {
      const body = this.matter.add.circle(spec.x, spec.y, 17, {
        density: 0.0015,
        friction: 0.9,
        frictionStatic: 0.95,
        restitution: 0.02,
        sleepThreshold: 45,
        label: `target:${spec.id}`,
      })
      const shadow = this.add.ellipse(spec.x, spec.y + 16, 40, 15, 0x000000, 0.22).setDepth(9)
      const sprite =
        spec.kind === 'crystal'
          ? this.add.sprite(spec.x, spec.y, 'p-star').setDepth(12).setScale(0.7)
          : this.add
              .sprite(spec.x, spec.y, 'grumplet-0-idle')
              .setDepth(12)
              .setScale((17 * 2.3) / 128)
      if (spec.kind === 'crystal') {
        sprite.setTint(0x9ff2ff)
      } else {
        const key = `grumplet-${spec.variant % 4}-idle`
        if (this.anims.exists(key)) sprite.play(key)
        if (this.textures.exists(`grumplet-${spec.variant % 4}-blink`)) {
          this.time.addEvent({
            delay: 2400 + Math.random() * 2600,
            loop: true,
            callback: () => {
              if (!sprite.active) return
              const blink = `grumplet-${spec.variant % 4}-blink`
              sprite.play(blink)
              sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                if (sprite.active) sprite.play(`grumplet-${spec.variant % 4}-idle`)
              })
            },
          })
        }
      }
      const runtime: TargetRuntime = {
        spec,
        body,
        sprite,
        shadow,
        defeated: false,
        health: TARGET_HEALTH,
      }
      this.targets.push(runtime)
      this.targetByBody.set(body.id, runtime)
    }
  }

  // ------------------------------------------------------------------- HUD

  private buildHud(): void {
    this.hud?.destroy(true)
    const root = this.add.container(0, 0).setDepth(60)
    const bar = panel(this, 20, 18, 680, 116, { fill: '#241a38', side: '#120c1e', radius: 22 })
    bar.setAlpha(0.94)
    root.add(bar)
    this.hudObjective = label(this, 44, 36, '', 15, '#ffe6a8', { fontStyle: 'bold' })
    this.hudProgress = label(this, 44, 62, '', 13, '#ffffff', { alpha: 0.86 })
    this.hudProgressBar = this.add.graphics()
    this.hudProgressBar.setPosition(44, 92)
    this.hudScore = label(this, 676, 36, '0', 22, '#ffffff', { origin: [1, 0], fontStyle: 'bold', fontFamily: '"Arial Black", sans-serif' })
    this.hudAmmo = label(this, 676, 70, '', 13, AMMO_BLUE, { origin: [1, 0], alpha: 0.95 })
    const quit = this.add
      .text(676, 100, '\u23F8', { fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff' })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
    quit.on('pointerup', () => this.togglePause())
    root.add([this.hudObjective, this.hudProgress, this.hudProgressBar, this.hudScore, this.hudAmmo, quit])

    const lower = panel(this, 20, 1148, 680, 116, { fill: '#1d1530', side: '#0d0817', radius: 22 })
    lower.setAlpha(0.94)
    root.add(lower)
    this.hudShip = label(this, 44, 1166, '', 15, '#ffffff', { fontStyle: 'bold' })
    this.hudAbility = label(this, 44, 1192, '', 13, '#bfe9ff', { alpha: 0.9, wrap: 380 })
    this.feverBar = this.add.graphics().setPosition(44, 1236)
    root.add([this.hudShip, this.hudAbility, this.feverBar])

    this.hud = root
    this.comboText = display(this, DESIGN_W / 2, 190, '', 34, '#ffe066').setAlpha(0).setDepth(58)
    this.bannerText = display(this, DESIGN_W / 2, 560, '', 46, '#ffffff').setAlpha(0).setDepth(58)
  }

  private refreshHud(): void {
    if (!this.hud) return
    this.hudObjective.setText(levelObjectiveText(this.level).toUpperCase())
    const stats = this.stats()
    const value = objectiveValue(this.level, stats)
    const goal = this.level.objective.count
    this.hudProgress.setText(
      this.level.objective.kind === 'score'
        ? `${formatNumber(value)} / ${formatNumber(goal)}`
        : this.level.objective.kind === 'material'
          ? `${value} / ${goal} ${this.level.objective.material}`
          : `${value} / ${goal}`,
    )
    const bar = this.hudProgressBar
    bar.clear()
    bar.fillStyle(0x000000, 0.35)
    bar.fillRoundedRect(0, 0, 380, 12, 6)
    const ratio = goal <= 0 ? 0 : Math.max(0, Math.min(1, value / goal))
    bar.fillStyle(ratio >= 1 ? 0x7ee36a : 0xffcf6a, 1)
    if (ratio > 0) bar.fillRoundedRect(0, 0, Math.max(10, 380 * ratio), 12, 6)
    this.hudScore.setText(formatNumber(this.score))
    this.hudAmmo.setText(`Ammo ${Math.max(0, this.ammoTotal - this.ammoUsed)}`)
    const def = projectileDef(this.currentType)
    if (this.phase === 'aim' || this.ships.length === 0) {
      this.hudShip.setText(`${def.name}`)
      this.hudAbility.setText(
        def.ability === 'none' ? def.blurb : `Ability: ${def.blurb.split('.')[0]}. Tap in flight.`,
      )
    }
    this.drawFever()
  }

  private drawFever(): void {
    const bar = this.feverBar
    bar.clear()
    bar.fillStyle(0x000000, 0.4)
    bar.fillRoundedRect(0, 0, 560, 9, 5)
    const ratio = this.feverMs > 0 ? this.feverMs / (FEVER_SECONDS * 1000) : this.feverCharge / FEVER_CHARGE
    bar.fillStyle(this.feverMs > 0 ? 0xff58d8 : 0x5fd4ff, 1)
    if (ratio > 0) bar.fillRoundedRect(0, 0, Math.max(8, 560 * Math.min(1, ratio)), 9, 5)
  }

  private stats(): ObjectiveStats {
    return {
      targetsDefeated: this.targetsDefeated,
      blocksDestroyed: this.blocksDestroyed,
      materialDestroyed: this.materialDestroyed,
      score: this.score,
    }
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.on('pointerupoutside', this.onPointerUp, this)
    this.input.keyboard?.on('keydown', this.onKey, this)
    this.input.once('pointerdown', () => sound.unlock())
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.phase === 'paused') return
    if (this.phase === 'flight') {
      this.activateAbility()
      return
    }
    if (this.phase !== 'aim' || !this.loaded) return
    const distance = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, SLING.x, SLING.y)
    if (distance > 150) return
    this.aiming = true
    this.pullFromPointer(pointer)
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'aim' || !this.aiming) return
    this.pullFromPointer(pointer)
  }

  private onPointerUp(): void {
    if (this.phase !== 'aim' || !this.aiming) return
    this.aiming = false
    if (pullPower(this.aimPull) < 0.12) {
      this.aimPull = { x: 0, y: 0 }
      this.positionLoaded()
      this.bands.clear()
      this.preview.clear()
      return
    }
    this.launch()
  }

  private pullFromPointer(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.worldX - SLING.x
    const dy = pointer.worldY - SLING.y
    const length = Math.hypot(dx, dy)
    const clamped = Math.min(length, SLING.maxPull)
    this.aimPull = length < 0.001 ? { x: 0, y: 0 } : { x: (dx / length) * clamped, y: (dy / length) * clamped }
    const power = pullPower(this.aimPull)
    if (power - this.lastSoundPull > 0.16) {
      this.lastSoundPull = power
      sound.stretch(power)
    }
    this.positionLoaded()
    this.drawAim()
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      this.togglePause()
      return
    }
    if (this.phase === 'paused') return
    if (this.phase === 'flight' && event.code === 'Space') {
      this.activateAbility()
      return
    }
    if (this.phase !== 'aim') return
    const step = event.shiftKey ? 1 : 3
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.keyAngle = Math.max(-12, this.keyAngle - step)
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.keyAngle = Math.min(78, this.keyAngle + step)
        break
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.keyPower = Math.min(1, this.keyPower + 0.05)
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        this.keyPower = Math.max(0.3, this.keyPower - 0.05)
        break
      case 'Enter':
        this.launchKeyboard()
        return
      case 'r':
      case 'R':
        this.scene.restart(this.payload)
        return
      default:
        return
    }
    this.aimFromKeyboard()
  }

  private aimFromKeyboard(): void {
    const radians = (this.keyAngle * Math.PI) / 180
    const length = this.keyPower * SLING.maxPull
    // The pull points back along the shot line, so the shot leaves to the right.
    this.aimPull = { x: -Math.cos(radians) * length, y: Math.sin(radians) * length }
    this.positionLoaded()
    this.drawAim()
  }

  private launchKeyboard(): void {
    if (this.phase !== 'aim' || !this.loaded) return
    this.aimFromKeyboard()
    this.launch()
  }

  private positionLoaded(): void {
    if (!this.loaded || !this.loadedShadow) return
    this.loaded.setPosition(SLING.x + this.aimPull.x, SLING.y + this.aimPull.y)
    this.loadedShadow.setPosition(SLING.x + this.aimPull.x, SLING.y + this.aimPull.y + 20)
    this.loaded.setRotation(this.aimPull.x * 0.004)
  }

  private drawAim(): void {
    this.bands.clear()
    this.preview.clear()
    const sprite = this.loaded
    if (!sprite) return
    const pouch = { x: sprite.x, y: sprite.y }
    const tipL = SLING.leftTip
    const tipR = SLING.rightTip
    for (const [tip, wobble] of [
      [tipL, -1],
      [tipR, 1],
    ] as const) {
      this.bands.lineStyle(9, 0x5a3a22, 1)
      this.bands.lineBetween(tip.x, tip.y, pouch.x, pouch.y + wobble * 10)
      this.bands.lineStyle(4, 0xc08a55, 1)
      this.bands.lineBetween(tip.x + wobble * 2, tip.y, pouch.x + wobble * 2, pouch.y + wobble * 10)
    }
    this.bands.fillStyle(0x7a4a2c, 1)
    this.bands.fillRoundedRect(pouch.x - 16, pouch.y - 6, 32, 22, 8)

    const guide = save().settings.guide
    if (guide >= 3) return
    const velocity = pullToVelocity(this.aimPull)
    if (Math.hypot(velocity.x, velocity.y) < 1) return
    const steps = guide === 1 ? 40 : guide === 2 ? 18 : 96
    const path = predictPath(pouch, velocity, steps, 2)
    // The cliffs are solid too, so the guide stops at the lip instead of
    // drawing a promise straight through rock.
    const hit = firstIntersection(
      path,
      [
        ...this.blocks.map((block) => ({
          x: block.body.position.x,
          y: block.body.position.y,
          w: block.spec.w,
          h: block.spec.h,
        })),
        { x: GROUND.x + GROUND.w / 2, y: GROUND.y + GROUND.h / 2, w: GROUND.w, h: GROUND.h },
      ],
      20,
    )
    const limit = hit ? hit.index : path.length
    for (let index = 0; index < limit; index += 1) {
      const point = path[index]!
      const t = index / Math.max(1, limit)
      const radius = 6 - t * 3.4
      this.preview.fillStyle(0xffffff, 0.16 + t * 0.4)
      this.preview.fillCircle(point.x, point.y, Math.max(1.8, radius))
    }
    if (hit) {
      this.preview.lineStyle(3, 0xffffff, 0.85)
      this.preview.strokeCircle(hit.point.x, hit.point.y, 16)
      this.preview.lineStyle(2, 0xffd27a, 0.65)
      this.preview.strokeCircle(hit.point.x, hit.point.y, 24)
    }
  }

  // ------------------------------------------------------------------ shots

  private loadNext(): void {
    if (this.ammoUsed >= this.queue.length) {
      this.finishRun(false)
      return
    }
    const type = this.queue[this.ammoUsed] ?? 'pippin'
    this.currentType = type
    const def = projectileDef(type)
    this.loaded?.destroy()
    this.loadedShadow?.destroy()
    this.loadedShadow = this.add.ellipse(SLING.x, SLING.y + 20, 46, 17, 0x000000, 0.26).setDepth(11)
    this.loaded = this.add
      .sprite(SLING.x, SLING.y, `sling-${type}-idle`)
      .setDepth(13)
      .setScale((def.radius * 2.5) / 128)
    if (this.anims.exists(`sling-${type}-idle`)) this.loaded.play(`sling-${type}-idle`)
    else this.loaded.setTexture('p-fluff').setTint(hex(def.color))
    this.aimPull = { x: 0, y: 0 }
    this.aiming = false
    this.phase = 'aim'
    this.preview.clear()
    this.bands.clear()
    this.positionLoaded()
    this.refreshHud()
  }

  private launch(): void {
    const def = projectileDef(this.currentType)
    const velocity = pullToVelocity(this.aimPull)
    const start = { x: SLING.x + this.aimPull.x, y: SLING.y + this.aimPull.y }
    this.loaded?.destroy()
    this.loadedShadow?.destroy()
    this.loaded = undefined
    this.loadedShadow = undefined
    this.bands.clear()
    this.preview.clear()

    const body = this.matter.add.circle(start.x, start.y, def.radius, {
      density: def.density,
      friction: 0.4,
      frictionAir: 0.002,
      restitution: def.restitution ?? 0.18,
      label: 'ship',
      sleepThreshold: 60,
    })
    this.matter.body.setVelocity(body, { x: velocity.x, y: velocity.y })
    const sprite = this.add
      .sprite(start.x, start.y, `sling-${this.currentType}-launch`)
      .setDepth(16)
      .setScale((def.radius * 2.6) / 128)
    if (this.anims.exists(`sling-${this.currentType}-launch`)) sprite.play(`sling-${this.currentType}-launch`)
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (sprite.active && this.anims.exists(`sling-${this.currentType}-idle`)) sprite.play(`sling-${this.currentType}-idle`)
    })
    const shadow = this.add.ellipse(start.x, start.y + 22, def.radius * 2, def.radius * 0.7, 0x000000, 0.18).setDepth(9)
    const ship: ShipRuntime = {
      type: this.currentType,
      body,
      sprite,
      shadow,
      abilityUsed: false,
      damageMul: def.damageMul,
      age: 0,
      trailMs: 0,
    }
    this.ships.push(ship)
    this.shipByBody.set(body.id, ship)
    this.ammoUsed += 1
    this.phase = 'flight'
    this.shotAge = 0
    this.settleMs = 0
    this.chain = 0
    sound.launch()
    this.cameras.main.shake(90, 0.0025)
    this.refreshHud()
    this.tweens.add({ targets: this.cameras.main, zoom: this.cameras.main.zoom * 0.995, duration: 90, yoyo: true })
  }

  // ---------------------------------------------------------------- collision

  private onCollision(event: {
    pairs?: Array<{ bodyA: Body; bodyB: Body; collision?: { supports?: Array<{ x: number; y: number }> } }>
  }): void {
    const pairs = event.pairs ?? []
    for (const pair of pairs) {
      const a = pair.bodyA
      const b = pair.bodyB
      const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y)
      if (speed < 1.2) continue
      const contact = pair.collision?.supports?.[0]
      this.damages.push({
        a: a.id,
        b: b.id,
        speed,
        x: contact ? contact.x : (a.position.x + b.position.x) / 2,
        y: contact ? contact.y : (a.position.y + b.position.y) / 2,
      })
    }
  }

  /** Damage is applied after the physics step, never inside the collision callback. */
  private processDamage(): void {
    if (this.damages.length === 0) return
    const impacts = this.damages
    this.damages = []
    for (const impact of impacts) {
      const blockA = this.blockByBody.get(impact.a)
      const blockB = this.blockByBody.get(impact.b)
      const targetA = this.targetByBody.get(impact.a)
      const targetB = this.targetByBody.get(impact.b)
      const shipA = this.shipByBody.get(impact.a)
      const shipB = this.shipByBody.get(impact.b)
      const massA = this.massOf(impact.a)
      const massB = this.massOf(impact.b)
      const reduced = massA > 0 && massB > 0 ? (massA * massB) / (massA + massB) : Math.max(massA, massB)
      const energy = impactEnergy(impact.speed, reduced)
      if (energy <= 0) continue

      const shipMul = shipA?.damageMul ?? shipB?.damageMul ?? 1
      const attacker = shipA ?? shipB
      if (blockA && !blockA.spec.fixed) this.damageBlock(blockA, energy, shipA || shipB ? shipMul : 0.55, impact)
      if (blockB && !blockB.spec.fixed) this.damageBlock(blockB, energy, shipA || shipB ? shipMul : 0.55, impact)
      if (targetA) this.damageTarget(targetA, energy)
      if (targetB) this.damageTarget(targetB, energy)
      if (attacker) sound.thud(blockA?.spec.material ?? blockB?.spec.material ?? 'wood', Math.min(1, impact.speed / 26))
      else if (impact.speed > 6) sound.thud(blockA?.spec.material ?? blockB?.spec.material ?? 'stone', 0.3)
    }
  }

  private massOf(bodyId: number): number {
    const block = this.blockByBody.get(bodyId)
    if (block) return block.body.isStatic ? 0 : block.body.mass
    const target = this.targetByBody.get(bodyId)
    if (target) return target.body.mass
    const ship = this.shipByBody.get(bodyId)
    if (ship) return ship.body.mass
    return 0
  }

  private damageBlock(block: BlockRuntime, energy: number, multiplier: number, impact: Impact): void {
    if (block.destroyed) return
    let mul = multiplier
    if (block.frozenUntil > this.elapsedMs) mul *= 1.5
    const damage = damageFor(energy, block.spec.material, mul)
    if (damage <= 0) return
    block.health -= damage
    const ratio = block.health / block.maxHealth
    block.crack.setAlpha(ratio <= 0.33 ? 0.85 : ratio <= 0.66 ? 0.55 : 0)
    block.crack.setTexture(ratio <= 0.33 ? 'crack-2' : 'crack-1')
    if (damage > 18) {
      this.shards.setParticleTint(materialDef(block.spec.material).light)
      this.shards.emitParticleAt(impact.x, impact.y, 3)
    }
    if (block.health <= 0) this.destroyBlock(block)
  }

  private damageTarget(target: TargetRuntime, energy: number): void {
    if (target.defeated) return
    const damage = (energy * 9.5) / TARGET_TOUGHNESS
    if (damage <= 0) return
    target.health -= damage
    if (target.spec.kind === 'crystal') {
      this.sparks.emitParticleAt(target.sprite.x, target.sprite.y, 4)
    }
    if (target.health <= 0) this.defeatTarget(target)
  }

  private destroyBlock(block: BlockRuntime, depth = 0): void {
    if (block.destroyed) return
    block.destroyed = true
    const def = materialDef(block.spec.material)
    const x = block.body.position.x
    const y = block.body.position.y
    this.matter.world.remove(block.body)
    block.tile.destroy()
    block.outline.destroy()
    block.crack.destroy()
    this.blockByBody.delete(block.body.id)
    this.blocksDestroyed += 1
    this.materialDestroyed[block.spec.material] = (this.materialDestroyed[block.spec.material] ?? 0) + 1
    this.chain += 1
    this.bestCombo = Math.max(this.bestCombo, this.chain)
    this.score += Math.round(blockScore(block.spec.material, this.chain) * (this.feverMs > 0 ? 2 : 1))
    this.addFever(feverChargeFor(block.spec.material === 'crate' ? 'crate' : 'block', this.chain))

    this.shards.setParticleTint(def.color)
    this.shards.emitParticleAt(x, y, block.spec.material === 'stone' ? 8 : 12)
    this.dust.setParticleTint(def.light)
    this.dust.emitParticleAt(x, y, 6)
    if (block.spec.material === 'glass' || block.spec.material === 'ice' || block.spec.material === 'crystal') {
      this.sparks.emitParticleAt(x, y, 8)
      sound.shatter()
    } else if (block.spec.material === 'metal') {
      this.sparks.emitParticleAt(x, y, 10)
      sound.thud('metal', 0.9)
    } else {
      sound.thud(block.spec.material, 0.7)
    }
    if (this.chain >= 2) this.showCombo()
    this.refreshHud()
    if (block.spec.material === 'crate' && depth < 3) this.explode(x, y, depth)
  }

  private explode(x: number, y: number, depth: number): void {
    if (this.explosions >= MAX_EXPLOSIONS) return
    this.explosions += 1
    sound.explode()
    this.cameras.main.shake(220, 0.006)
    this.smoke.emitParticleAt(x, y, 16)
    this.sparks.emitParticleAt(x, y, 22)
    this.stars.emitParticleAt(x, y, 8)
    this.flashRing(x, y, BLAST_RADIUS, 0xffb347)
    const nearby = this.blocks.filter(
      (block) => !block.destroyed && Phaser.Math.Distance.Between(x, y, block.body.position.x, block.body.position.y) <= BLAST_RADIUS,
    )
    for (const block of nearby) {
      const distance = Phaser.Math.Distance.Between(x, y, block.body.position.x, block.body.position.y)
      const falloff = Math.max(0, 1 - distance / BLAST_RADIUS)
      this.shove(block.body, x, y, 7 * falloff)
      this.damageBlock(block, BLAST_POWER * falloff, 1, {
        a: 0,
        b: block.body.id,
        speed: 0,
        x: block.body.position.x,
        y: block.body.position.y,
      })
    }
    for (const target of this.targets) {
      if (target.defeated) continue
      const distance = Phaser.Math.Distance.Between(x, y, target.body.position.x, target.body.position.y)
      if (distance > BLAST_RADIUS) continue
      const falloff = Math.max(0, 1 - distance / BLAST_RADIUS)
      this.shove(target.body, x, y, 8 * falloff)
      target.health -= 120 * falloff
      if (target.health <= 0) this.defeatTarget(target)
    }
    void depth
  }

  private shove(body: Body, x: number, y: number, force: number): void {
    const dx = body.position.x - x
    const dy = body.position.y - y
    const length = Math.max(1, Math.hypot(dx, dy))
    this.matter.body.setVelocity(body, {
      x: body.velocity.x + (dx / length) * force,
      y: body.velocity.y + (dy / length) * force - force * 0.3,
    })
  }

  private defeatTarget(target: TargetRuntime): void {
    if (target.defeated) return
    target.defeated = true
    const x = target.body.position.x
    const y = target.body.position.y
    this.matter.world.remove(target.body)
    target.sprite.destroy()
    target.shadow.destroy()
    this.targetByBody.delete(target.body.id)
    this.targetsDefeated += 1
    this.chain += 1
    this.bestCombo = Math.max(this.bestCombo, this.chain)
    this.score += Math.round(targetScore(target.spec.kind, this.chain) * (this.feverMs > 0 ? 2 : 1))
    this.addFever(feverChargeFor('target', this.chain))
    this.smoke.emitParticleAt(x, y, 10)
    this.stars.emitParticleAt(x, y, 10)
    this.flashRing(x, y, 80, 0xffe066)
    sound.squeak(true)
    this.showScore(x, y, targetScore(target.spec.kind, this.chain))
    this.showCombo()
    this.refreshHud()
    if (objectiveComplete(this.level, this.stats()) && !this.finishing) {
      this.finishing = true
      this.time.delayedCall(650, () => this.finishRun(true))
    }
  }

  private addFever(amount: number): void {
    if (this.feverMs > 0) return
    this.feverCharge = Math.min(FEVER_CHARGE, this.feverCharge + amount)
    if (this.feverCharge >= FEVER_CHARGE) {
      this.feverCharge = 0
      this.feverMs = FEVER_SECONDS * 1000
      sound.fever()
      sound.startMusic('fever')
      this.showBanner('SLINGSTORM FEVER!', '#ff9be8')
      this.cameras.main.flash(220, 255, 120, 220, false)
    }
  }

  // ---------------------------------------------------------------- abilities

  private activateAbility(): void {
    const ship = this.ships.find((candidate) => !candidate.abilityUsed)
    if (!ship || this.phase !== 'flight') return
    const def = projectileDef(ship.type)
    if (def.ability === 'none') return
    ship.abilityUsed = true
    const x = ship.body.position.x
    const y = ship.body.position.y
    switch (def.ability) {
      case 'blast':
        this.removeShip(ship)
        this.explode(x, y, 0)
        break
      case 'split': {
        this.removeShip(ship)
        const speed = Math.hypot(ship.body.velocity.x, ship.body.velocity.y)
        const baseAngle = Math.atan2(ship.body.velocity.y, ship.body.velocity.x)
        for (const offset of [-0.32, 0, 0.32]) {
          const angle = baseAngle + offset
          this.spawnExtraShip('triplet', x, y, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, 0.7)
        }
        sound.pop(2)
        break
      }
      case 'drill':
        ship.damageMul = 3.4
        this.sparks.emitParticleAt(x, y, 10)
        sound.whoosh()
        break
      case 'chain': {
        const nearby = this.blocks
          .filter((block) => !block.destroyed && Phaser.Math.Distance.Between(x, y, block.body.position.x, block.body.position.y) < 260)
          .slice(0, 3)
        let from = { x, y }
        for (const block of nearby) {
          const to = { x: block.body.position.x, y: block.body.position.y }
          this.lightning(from, to)
          this.damageBlock(block, 480, 1, { a: 0, b: block.body.id, speed: 0, x: to.x, y: to.y })
          from = to
        }
        sound.zap()
        break
      }
      case 'freeze': {
        const until = this.elapsedMs + 6000
        for (const block of this.blocks) {
          if (block.destroyed) continue
          if (Phaser.Math.Distance.Between(x, y, block.body.position.x, block.body.position.y) > 190) continue
          block.frozenUntil = until
          block.tile.setTint(0x9fe8ff)
          this.time.delayedCall(6000, () => {
            if (block.tile.active) block.tile.clearTint()
          })
        }
        this.flashRing(x, y, 190, 0x9fe8ff)
        this.sparks.emitParticleAt(x, y, 16)
        sound.freeze()
        break
      }
      case 'bounce':
        this.matter.body.setVelocity(ship.body, {
          x: ship.body.velocity.x * 1.2 + (Math.random() - 0.5) * 3,
          y: ship.body.velocity.y * 1.2 - 2,
        })
        this.sparks.emitParticleAt(x, y, 8)
        sound.pop(1)
        break
      case 'heavy':
        for (const block of this.blocks) {
          if (block.destroyed) continue
          if (Phaser.Math.Distance.Between(x, y, block.body.position.x, block.body.position.y) > 170) continue
          this.shove(block.body, x, y, 9)
          this.damageBlock(block, 700, 1.6, { a: 0, b: block.body.id, speed: 0, x: block.body.position.x, y: block.body.position.y })
        }
        this.cameras.main.shake(260, 0.008)
        this.smoke.emitParticleAt(x, y, 18)
        sound.rumble()
        break
      case 'magnet': {
        for (const block of this.blocks) {
          if (block.destroyed || block.spec.material !== 'metal') continue
          if (Phaser.Math.Distance.Between(x, y, block.body.position.x, block.body.position.y) > 240) continue
          this.shove(block.body, x, y, -10)
        }
        this.flashRing(x, y, 240, 0xb28dff)
        sound.zap()
        break
      }
      case 'gust': {
        for (const body of [...this.blocks.map((block) => block.body), ...this.targets.map((target) => target.body)]) {
          if (Phaser.Math.Distance.Between(x, y, body.position.x, body.position.y) > 240) continue
          this.matter.body.setVelocity(body, { x: body.velocity.x + 5, y: body.velocity.y - 8 })
        }
        this.flashRing(x, y, 240, 0xd9fff4)
        this.smoke.emitParticleAt(x, y, 14)
        sound.whoosh()
        break
      }
      default:
        break
    }
    this.refreshHud()
  }

  private spawnExtraShip(type: ProjectileId, x: number, y: number, velocity: Vec2, scale: number): void {
    const def = projectileDef(type)
    const radius = def.radius * 0.62
    const body = this.matter.add.circle(x, y, radius, {
      density: def.density,
      friction: 0.4,
      frictionAir: 0.002,
      restitution: 0.2,
      label: 'ship',
    })
    this.matter.body.setVelocity(body, velocity)
    const sprite = this.add
      .sprite(x, y, `sling-${type}-launch`)
      .setDepth(16)
      .setScale((radius * 2.6) / 128)
    if (this.anims.exists(`sling-${type}-idle`)) sprite.play(`sling-${type}-idle`)
    const shadow = this.add.ellipse(x, y + 16, radius * 2, radius * 0.6, 0x000000, 0.16).setDepth(9)
    const ship: ShipRuntime = {
      type,
      body,
      sprite,
      shadow,
      abilityUsed: true,
      damageMul: def.damageMul * scale,
      age: 0,
      trailMs: 0,
    }
    this.ships.push(ship)
    this.shipByBody.set(body.id, ship)
  }

  private removeShip(ship: ShipRuntime): void {
    this.matter.world.remove(ship.body)
    this.shipByBody.delete(ship.body.id)
    ship.sprite.destroy()
    ship.shadow.destroy()
    this.ships = this.ships.filter((candidate) => candidate !== ship)
  }

  private lightning(from: Vec2, to: Vec2): void {
    const graphics = this.add.graphics().setDepth(20)
    graphics.lineStyle(5, 0xfff27a, 0.95)
    graphics.beginPath()
    graphics.moveTo(from.x, from.y)
    const segments = 5
    for (let index = 1; index <= segments; index += 1) {
      const t = index / segments
      graphics.lineTo(
        from.x + (to.x - from.x) * t + (Math.random() - 0.5) * 26,
        from.y + (to.y - from.y) * t + (Math.random() - 0.5) * 26,
      )
    }
    graphics.strokePath()
    this.tweens.add({ targets: graphics, alpha: 0, duration: 220, onComplete: () => graphics.destroy() })
  }

  // ------------------------------------------------------------------ effects

  private createEmitters(): void {
    this.dust = this.add
      .particles(0, 0, 'p-smoke', {
        speed: { min: 16, max: 70 },
        lifespan: { min: 380, max: 780 },
        scale: { start: 0.5, end: 1.7 },
        alpha: { start: 0.5, end: 0 },
        emitting: false,
      })
      .setDepth(22)
    this.shards = this.add
      .particles(0, 0, 'p-shard', {
        speed: { min: 60, max: 240 },
        lifespan: { min: 320, max: 720 },
        scale: { start: 0.42, end: 0.02 },
        rotate: { min: 0, max: 360 },
        gravityY: 420,
        emitting: false,
      })
      .setDepth(23)
    this.sparks = this.add
      .particles(0, 0, 'p-star', {
        speed: { min: 40, max: 200 },
        lifespan: { min: 260, max: 620 },
        scale: { start: 0.34, end: 0 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(24)
    this.smoke = this.add
      .particles(0, 0, 'p-smoke', {
        speed: { min: 30, max: 120 },
        lifespan: { min: 500, max: 1000 },
        scale: { start: 0.7, end: 2.1 },
        alpha: { start: 0.55, end: 0 },
        emitting: false,
      })
      .setDepth(21)
    this.stars = this.add
      .particles(0, 0, 'p-star', {
        speed: { min: 50, max: 190 },
        lifespan: { min: 500, max: 1100 },
        scale: { start: 0.5, end: 0 },
        tint: [0xffd85c, 0xff8ad8, 0x8fe6ff],
        emitting: false,
      })
      .setDepth(25)
  }

  private flashRing(x: number, y: number, radius: number, color: number): void {
    const ring = this.add.circle(x, y, radius * 0.85, color, 0).setStrokeStyle(5, color, 0.9).setDepth(24)
    ring.setScale(0.18)
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 380,
      ease: 'Quad.out',
      onComplete: () => ring.destroy(),
    })
  }

  private showScore(x: number, y: number, value: number): void {
    const text = display(this, x, y - 20, `+${formatNumber(value)}`, 22, '#ffe066').setDepth(30)
    this.tweens.add({
      targets: text,
      y: y - 80,
      alpha: 0,
      duration: 760,
      ease: 'Quad.out',
      onComplete: () => text.destroy(),
    })
  }

  private showCombo(): void {
    if (!this.comboText) return
    this.comboText.setText(comboWord(this.chain))
    this.comboText.setAlpha(1)
    this.comboText.setScale(1.25)
    this.tweens.killTweensOf(this.comboText)
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 220, ease: 'Back.out' })
    this.tweens.add({ targets: this.comboText, alpha: 0, delay: 520, duration: 420 })
    if (this.chain >= 4) this.cameras.main.shake(180, 0.004)
  }

  private showBanner(text: string, color: string): void {
    if (!this.bannerText) return
    this.bannerText.setText(text).setColor(color).setAlpha(1).setScale(0.85)
    this.tweens.killTweensOf(this.bannerText)
    this.tweens.add({ targets: this.bannerText, scale: 1.05, duration: 260, ease: 'BackOut' })
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 900, duration: 420 })
  }

  // ------------------------------------------------------------------- flow

  override update(_time: number, delta: number): void {
    if (this.phase === 'paused') return
    this.elapsedMs += delta
    if (this.feverMs > 0) {
      this.feverMs = Math.max(0, this.feverMs - delta)
      if (this.feverMs === 0) {
        sound.startMusic(this.mode === 'zen' ? 'zen' : 'play')
        this.refreshHud()
      }
      this.drawFever()
    }

    if (this.mode === 'blitz' && this.phase !== 'done') {
      this.blitzLeft = Math.max(0, this.blitzLeft - delta)
      if (this.blitzLeft === 0) {
        this.finishRun(false)
        return
      }
    }

    for (let step = 0; step < SUBSTEPS; step += 1) this.matter.world.step(SUBSTEP_MS)
    this.processDamage()
    this.syncBodies()
    this.updateShips(delta)
    this.checkFallers()
    this.updateSettle(delta)

    if (this.phase === 'aim' && this.aiming) this.drawAim()
  }

  private syncBodies(): void {
    for (const block of this.blocks) {
      if (block.destroyed || !block.tile.active) continue
      const body = block.body
      block.tile.setPosition(body.position.x, body.position.y).setRotation(body.angle)
      block.outline.setPosition(body.position.x, body.position.y).setRotation(body.angle)
      block.crack.setPosition(body.position.x, body.position.y).setRotation(body.angle)
    }
    for (const target of this.targets) {
      if (target.defeated || !target.sprite.active) continue
      const body = target.body
      target.sprite.setPosition(body.position.x, body.position.y).setRotation(body.angle * 0.35)
      target.shadow.setPosition(body.position.x, body.position.y + 16)
    }
  }

  private updateShips(delta: number): void {
    for (const ship of [...this.ships]) {
      ship.age += delta
      const body = ship.body
      ship.sprite.setPosition(body.position.x, body.position.y).setRotation(body.angle)
      ship.shadow.setPosition(body.position.x, body.position.y + 22)
      ship.shadow.setAlpha(Math.max(0, 0.2 - (1000 - body.position.y) / 6000))
      ship.trailMs += delta
      if (ship.trailMs > 42 && Math.abs(body.velocity.y) + Math.abs(body.velocity.x) > 1.5) {
        ship.trailMs = 0
        this.sparks.emitParticleAt(body.position.x, body.position.y, 1)
      }
      const out = body.position.y < -220 || body.position.y > 1340 || body.position.x < -180 || body.position.x > 900
      const stuck = Math.hypot(body.velocity.x, body.velocity.y) < 0.25 && ship.age > 900
      if (out || stuck || ship.age > 12_000) this.removeShip(ship)
    }
    if (this.ships.length === 0 && this.phase === 'flight') this.phase = 'settle'
  }

  private checkFallers(): void {
    for (const target of this.targets) {
      if (target.defeated) continue
      if (target.body.position.y > 1180) this.defeatTarget(target)
    }
    for (const block of this.blocks) {
      if (block.destroyed) continue
      if (block.body.position.y > 1360) {
        block.destroyed = true
        this.matter.world.remove(block.body)
        block.tile.destroy()
        block.outline.destroy()
        block.crack.destroy()
        this.blockByBody.delete(block.body.id)
      }
    }
  }

  private updateSettle(delta: number): void {
    if (this.phase !== 'flight' && this.phase !== 'settle') return
    this.shotAge += delta
    const busy =
      this.ships.length > 0 ||
      this.blocks.some((block) => !block.destroyed && Math.hypot(block.body.velocity.x, block.body.velocity.y) > 0.35) ||
      this.targets.some((target) => !target.defeated && Math.hypot(target.body.velocity.x, target.body.velocity.y) > 0.35)
    if (!busy) this.settleMs += delta
    else this.settleMs = 0
    if (this.settleMs > 420 || this.shotAge > 3400) this.afterShot()
  }

  private afterShot(): void {
    if (this.phase === 'done') return
    if (this.finishing) return
    if (objectiveComplete(this.level, this.stats())) {
      this.finishing = true
      this.finishRun(true)
      return
    }
    if (this.ammoUsed >= this.queue.length) {
      this.finishRun(false)
      return
    }
    this.phase = 'aim'
    this.loadNext()
  }

  private finishRun(won: boolean): void {
    if (this.phase === 'done') return
    this.phase = 'done'
    this.preview.clear()
    this.bands.clear()
    this.aiming = false
    const earnedStars = won ? starsFor(this.level, this.ammoUsed) : 0
    if (won) this.score += unusedShotScore(this.queue.length - this.ammoUsed)
    syncAchievements()
    if (won) {
      sound.win()
      this.showBanner(this.mode === 'journey' ? 'TOWER DOWN!' : 'STAGE CLEAR!', '#ffe066')
      this.celebrate()
      this.time.delayedCall(1500, () => this.advance(won, earnedStars))
    } else {
      sound.lose()
      this.showBanner('OUT OF AMMO', '#ff9c9c')
      this.time.delayedCall(900, () => this.advance(false, 0))
    }
  }

  private celebrate(): void {
    if (save().settings.quality === 'low') return
    for (let burst = 0; burst < 6; burst += 1) {
      this.time.delayedCall(burst * 120, () => {
        this.stars.emitParticleAt(140 + Math.random() * 440, 300 + Math.random() * 380, 12)
      })
    }
  }

  private advance(won: boolean, stars: number): void {
    const chained = this.mode === 'endless' || this.mode === 'blitz' || this.mode === 'zen'
    if (won && chained) {
      this.phase = 'aim'
      this.beginStage(this.stage + 1)
      return
    }
    const summary: RunSummary = {
      mode: this.mode,
      levelId: this.level.id,
      world: this.level.world,
      won,
      score: this.score,
      stars,
      shotsUsed: this.ammoUsed,
      ammo: this.queue.length,
      targetsDefeated: this.targetsDefeated,
      targetsTotal: this.level.targets.length,
      blocksDestroyed: this.blocksDestroyed,
      bestCombo: this.bestCombo,
      elapsedMs: this.elapsedMs,
    }
    this.cameras.main.fadeOut(240, 10, 8, 20)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Results', summary)
    })
  }

  private togglePause(): void {
    if (this.phase === 'done') return
    if (this.phase === 'paused') {
      this.pauseLayer?.destroy(true)
      this.pauseLayer = undefined
      this.phase = this.ships.length > 0 ? 'flight' : 'aim'
      this.matter.world.resume()
      return
    }
    this.phase = 'paused'
    this.matter.world.pause()
    const root = this.add.container(0, 0).setDepth(90)
    const shade = this.add.rectangle(DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, 0x08060f, 0.72)
    shade.setInteractive()
    root.add(shade)
    root.add(display(this, DESIGN_W / 2, 380, 'PAUSED', 48, '#ffffff'))
    root.add(
      button(this, DESIGN_W / 2, 520, 'RESUME', () => this.togglePause(), { width: 360, height: 84 }),
    )
    root.add(
      button(
        this,
        DESIGN_W / 2,
        624,
        'RESTART',
        () => {
          this.matter.world.resume()
          this.scene.restart(this.payload)
        },
        { width: 360, height: 84, fill: '#4a3550' },
      ),
    )
    root.add(
      button(
        this,
        DESIGN_W / 2,
        728,
        'QUIT TO MENU',
        () => {
          this.matter.world.resume()
          this.scene.start('Menu')
        },
        { width: 360, height: 84, fill: '#38283f' },
      ),
    )
    this.pauseLayer = root
  }
}

