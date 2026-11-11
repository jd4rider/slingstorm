import Phaser from 'phaser'
import { sound } from '../core/audio'
import { save, todayKey, totalStars } from '../core/saves'
import { WORLDS } from '../data/worlds'
import { Backdrop } from './Backdrop'
import { button, display, fadeIn, fadeTo, formatNumber, label } from './common'
import { DESIGN_W, designStage } from './layout'
import { SLINGLING_KEYS } from './art'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    fadeIn(this)
    const stage = designStage(this)
    const data = save()
    const world = WORLDS[Math.min(WORLDS.length - 1, Math.floor((data.unlocked - 1) / 50))]!
    const backdrop = new Backdrop(this, world, { motes: true })
    stage.root.add(backdrop.container)

    this.heroes(stage.root)

    stage.root.add(label(this, DESIGN_W / 2, 108, 'AIM HIGH \u00b7 HIT HARD \u00b7 BRING IT ALL DOWN', 12, '#ffe6a8', {
      origin: 0.5,
      letterSpacing: 1.4,
      fontStyle: 'bold',
    }))
    const logo = display(this, DESIGN_W / 2, 168, 'SLINGSTORM', 54, '#ffffff')
    stage.root.add(logo)
    this.tweens.add({ targets: logo, y: 160, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' })
    stage.root.add(
      label(this, DESIGN_W / 2, 212, `${formatNumber(totalStars(data))} stars \u00b7 World ${world.id + 1}: ${world.name}`, 13, '#ffffff', {
        origin: 0.5,
        alpha: 0.85,
      }),
    )

    const start = (mode: string, extra: object = {}): void => {
      fadeTo(this, 'Game', { mode, ...extra })
    }

    const rows: Array<[string, () => void, string]> = [
      [
        `CONTINUE \u00b7 LEVEL ${data.unlocked}`,
        () => start('journey', { levelId: data.unlocked }),
        `World ${Math.floor((data.unlocked - 1) / 50) + 1} \u00b7 Level ${data.unlocked}`,
      ],
      ['PUZZLE JOURNEY', () => fadeTo(this, 'Journey'), '500 levels across ten worlds'],
      ['ENDLESS SIEGE', () => start('endless', { seed: 7 }), 'Tower after tower, one ammo pool'],
      ['DESTRUCTION BLITZ', () => start('blitz', { seed: 21 }), 'Two minutes of maximum collapse'],
      ['PRECISION CHALLENGE', () => start('precision', { levelId: data.unlocked }), 'No spare shots. Make them count'],
      ['ZEN DEMOLITION', () => start('zen', { seed: 5 }), 'Unlimited ammo, no timer'],
      ['DAILY SIEGE', () => start('daily', { seed: 1 }), `Seeded challenge \u00b7 ${todayKey()}`],
    ]

    let y = 322
    for (const [title, action, subtitle] of rows) {
      stage.root.add(button(this, DESIGN_W / 2, y, title, action, { width: 500, height: 84, subtitle }))
      y += 96
    }

    stage.root.add(
      button(this, DESIGN_W / 2 - 130, y + 14, 'COLLECTION', () => fadeTo(this, 'Collection'), {
        width: 232,
        height: 68,
        fill: '#2f2547',
        size: 18,
      }),
    )
    stage.root.add(
      button(this, DESIGN_W / 2 + 130, y + 14, 'SETTINGS', () => fadeTo(this, 'Settings'), {
        width: 232,
        height: 68,
        fill: '#2f2547',
        size: 18,
      }),
    )

    sound.startMusic('menu')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sound.stopMusic())
  }

  /** A few slinglings arcing across the sky, so the menu is never static. */
  private heroes(root: Phaser.GameObjects.Container): void {
    const picks = ['pippin', 'boomkin', 'frostpop', 'ricco', 'nimbus']
    picks.forEach((key, index) => {
      if (!SLINGLING_KEYS.includes(key as (typeof SLINGLING_KEYS)[number])) return
      const sprite = this.add.sprite(-120 - index * 60, 300 + index * 40, `sling-${key}-idle`)
      sprite.setScale(0.72)
      if (this.anims.exists(`sling-${key}-idle`)) sprite.play(`sling-${key}-idle`)
      root.add(sprite)
      const duration = 9000 + index * 1400
      this.tweens.add({
        targets: sprite,
        x: DESIGN_W + 140,
        duration,
        repeat: -1,
        delay: index * 900,
        onRepeat: () => sprite.setX(-140),
      })
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 90,
        duration: duration / 4,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
      this.tweens.add({
        targets: sprite,
        angle: { from: -12, to: 12 },
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      })
    })
  }
}
