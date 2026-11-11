import Phaser from 'phaser'
import { save, syncAchievements } from '../core/saves'
import { sound } from '../core/audio'
import { GRUMPLET_ACTIONS, GRUMPLET_KEYS, SLINGLING_ACTIONS, SLINGLING_KEYS, ART_FRAME_SIZE } from './art'
import { projectileDef } from '../game/projectiles'
import { buildCharacterFallback, buildTextures } from './textures'
import { Backdrop } from './Backdrop'
import { display, label } from './common'
import { DESIGN_H, DESIGN_W } from './layout'
import { worldDef } from '../data/worlds'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  /**
   * The cast is modelled, furred and animated in Blender
   * (art/blender/characters.py) and shipped as transparent spritesheets: four
   * columns of 128px frames per action. Anything missing falls back to a
   * painted stand-in, so a clean checkout still runs.
   */
  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      // A missing sheet is handled in create(); the loader error is expected.
    })
    for (const key of SLINGLING_KEYS) {
      for (const [action, spec] of Object.entries(SLINGLING_ACTIONS)) {
        this.load.spritesheet(`sling-${key}-${action}`, `art/slingling-${key}-${action}.png`, {
          frameWidth: ART_FRAME_SIZE,
          frameHeight: ART_FRAME_SIZE,
          endFrame: spec.frames - 1,
        })
      }
    }
    for (const variant of GRUMPLET_KEYS) {
      for (const [action, spec] of Object.entries(GRUMPLET_ACTIONS)) {
        this.load.spritesheet(`grumplet-${variant}-${action}`, `art/grumplet-${variant}-${action}.png`, {
          frameWidth: ART_FRAME_SIZE,
          frameHeight: ART_FRAME_SIZE,
          endFrame: spec.frames - 1,
        })
      }
    }
    this.load.image('slingshot', 'art/slingshot.png')
  }

  create(): void {
    buildTextures(this)
    this.buildAnimations()

    const data = save()
    sound.setVolumes(data.settings.sfx, data.settings.music)
    sound.setMuted(data.settings.muted)
    syncAchievements()

    new Backdrop(this, worldDef(0), { motes: false, animate: false })
    display(this, DESIGN_W / 2, DESIGN_H / 2 - 40, 'SLINGSTORM', 46, '#ffffff')
    label(this, DESIGN_W / 2, DESIGN_H / 2 + 30, 'Loading the towers...', 18, '#ffffff', {
      origin: 0.5,
      alpha: 0.75,
    })

    this.cameras.main.fadeIn(200, 255, 255, 255)
    this.time.delayedCall(260, () => {
      this.cameras.main.fadeOut(170, 12, 10, 24)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Menu'))
    })
  }

  private buildAnimations(): void {
    for (const key of SLINGLING_KEYS) {
      for (const [action, spec] of Object.entries(SLINGLING_ACTIONS)) {
        const texture = `sling-${key}-${action}`
        if (!this.animationReady(texture, spec.frames)) {
          if (!this.textures.exists(texture)) {
            const def = projectileDef(key)
            buildCharacterFallback(this, texture, def.color, def.deep, 44)
          }
          // A single painted still has no frames to animate; play() must never
          // be reached for it.
          continue
        }
        if (!this.anims.exists(texture)) {
          this.anims.create({
            key: texture,
            frames: this.anims.generateFrameNumbers(texture, { start: 0, end: spec.frames - 1 }),
            frameRate: spec.fps,
            repeat: spec.repeat ? -1 : 0,
          })
        }
      }
    }
    for (const variant of GRUMPLET_KEYS) {
      for (const [action, spec] of Object.entries(GRUMPLET_ACTIONS)) {
        const texture = `grumplet-${variant}-${action}`
        if (!this.animationReady(texture, spec.frames)) {
          if (!this.textures.exists(texture)) buildCharacterFallback(this, texture, '#6fbf63', '#3d7a35', 40)
          continue
        }
        if (!this.anims.exists(texture)) {
          this.anims.create({
            key: texture,
            frames: this.anims.generateFrameNumbers(texture, { start: 0, end: spec.frames - 1 }),
            frameRate: spec.fps,
            repeat: spec.repeat ? -1 : 0,
          })
        }
      }
    }
  }

  /** True only when the texture actually holds the full strip of frames. */
  private animationReady(texture: string, frames: number): boolean {
    if (!this.textures.exists(texture)) return false
    return this.textures.get(texture).frameTotal - 1 >= frames
  }
}
