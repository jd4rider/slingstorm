import Phaser from 'phaser'
import type { WorldDef } from '../data/worlds'
import { hex } from './common'
import { DESIGN_H, DESIGN_W } from './layout'

export interface BackdropOptions {
  /** 0..1 dark overlay, so gameplay HUD stays readable over the scenery. */
  dim?: number
  motes?: boolean
  animate?: boolean
}

/**
 * Layered parallax scenery per world: a gradient sky, two hill ranges, a near
 * ridge, drifting clouds and floating motes. Everything is drawn with graphics
 * and a handful of shapes, so there are no background assets to download.
 */
export class Backdrop {
  readonly container: Phaser.GameObjects.Container
  private readonly clouds: Phaser.GameObjects.Container[] = []

  constructor(private readonly scene: Phaser.Scene, world: WorldDef, options: BackdropOptions = {}) {
    const children: Phaser.GameObjects.GameObject[] = []
    const sky = scene.add.graphics()
    sky.fillGradientStyle(hex(world.sky[0]), hex(world.sky[0]), hex(world.sky[1]), hex(world.sky[1]), 1)
    sky.fillRect(0, 0, DESIGN_W, DESIGN_H)
    children.push(sky)

    const glow = scene.add.graphics()
    glow.fillStyle(hex(world.accent), 0.16)
    glow.fillCircle(DESIGN_W * 0.72, 240, 190)
    glow.fillStyle(hex('#ffffff'), 0.1)
    glow.fillCircle(DESIGN_W * 0.72, 240, 130)
    children.push(glow)

    const far = scene.add.graphics()
    far.fillStyle(hex(world.far), 0.75)
    far.fillPoints(this.ridge(560, 150, 7), true)
    far.fillStyle(hex(world.far), 1)
    far.fillPoints(this.ridge(680, 110, 9), true)
    children.push(far)

    const near = scene.add.graphics()
    near.fillStyle(hex(world.near), 1)
    near.fillPoints(this.ridge(900, 80, 6), true)
    near.fillStyle(hex('#000000'), 0.18)
    near.fillPoints(this.ridge(980, 60, 5), true)
    children.push(near)

    if (options.motes !== false) {
      for (let index = 0; index < 18; index += 1) {
        const mote = scene.add.circle(
          Math.random() * DESIGN_W,
          120 + Math.random() * (DESIGN_H - 240),
          1.5 + Math.random() * 2.6,
          hex(world.accent),
          0.4 + Math.random() * 0.4,
        )
        children.push(mote)
        if (options.animate !== false) {
          scene.tweens.add({
            targets: mote,
            y: mote.y - 40 - Math.random() * 60,
            alpha: 0.1,
            duration: 3200 + Math.random() * 2600,
            yoyo: true,
            repeat: -1,
            delay: Math.random() * 2200,
            ease: 'Sine.inOut',
          })
        }
      }
    }

    if (options.animate !== false) {
      for (let index = 0; index < 3; index += 1) {
        const cloud = scene.add.container(-140 + index * 300, 120 + index * 90)
        const puff = scene.add.graphics()
        puff.fillStyle(hex('#ffffff'), 0.3)
        puff.fillEllipse(0, 0, 190, 62)
        puff.fillEllipse(-52, 12, 120, 46)
        puff.fillEllipse(58, 10, 132, 50)
        cloud.add(puff)
        children.push(cloud)
        this.clouds.push(cloud)
        scene.tweens.add({
          targets: cloud,
          x: DESIGN_W + 160,
          duration: 26000 + index * 9000,
          repeat: -1,
          delay: index * 4000,
          onRepeat: () => cloud.setX(-160),
        })
      }
    }

    if (options.dim && options.dim > 0) {
      const shade = scene.add.graphics()
      shade.fillStyle(0x08060f, options.dim)
      shade.fillRect(0, 0, DESIGN_W, DESIGN_H)
      children.push(shade)
    }

    this.container = scene.add.container(0, 0, children)
  }

  private ridge(baseY: number, amplitude: number, peaks: number): Phaser.Geom.Point[] {
    const points: Phaser.Geom.Point[] = [new Phaser.Geom.Point(-20, DESIGN_H + 20), new Phaser.Geom.Point(-20, baseY)]
    for (let index = 0; index <= peaks; index += 1) {
      const x = (index / peaks) * (DESIGN_W + 40) - 20
      const y = baseY - Math.sin(index * 1.7 + baseY * 0.01) * amplitude - (index % 2) * amplitude * 0.4
      points.push(new Phaser.Geom.Point(x, y))
    }
    points.push(new Phaser.Geom.Point(DESIGN_W + 20, baseY), new Phaser.Geom.Point(DESIGN_W + 20, DESIGN_H + 20))
    return points
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.clouds)
  }
}
