import Phaser from 'phaser'
import { sound } from '../core/audio'
import { save, update, type Quality } from '../core/saves'
import { WORLDS } from '../data/worlds'
import { Backdrop } from './Backdrop'
import { button, display, fadeIn, fadeTo, label } from './common'
import { DESIGN_W, designStage, type Stage } from './layout'
import { arcade } from '../integration/LittleJoyAdapter'

const QUALITIES: Quality[] = ['low', 'medium', 'high']
const GUIDES = ['Full guide', 'Short guide', 'Minimal guide', 'Guide off']

export class SettingsScene extends Phaser.Scene {
  private stage!: Stage
  private content!: Phaser.GameObjects.Container

  constructor() {
    super('Settings')
  }

  create(): void {
    fadeIn(this)
    this.stage = designStage(this)
    this.content = this.add.container(0, 0)
    this.stage.root.add(this.content)
    this.render()
  }

  private render(): void {
    this.content.removeAll(true)
    const data = save()
    const backdrop = new Backdrop(this, WORLDS[0]!, { motes: false, animate: false, dim: 0.45 })
    this.content.add(backdrop.container)
    this.content.add(
      button(this, 78, 62, '\u2190', () => fadeTo(this, 'Menu'), { width: 84, height: 60, size: 22, fill: '#2f2547' }),
    )
    this.content.add(display(this, DESIGN_W / 2, 62, 'SETTINGS', 26, '#ffffff'))

    const card = this.add.container(DESIGN_W / 2, 470)
    card.add(this.add.rectangle(0, 0, 600, 700, 0x241a38, 0.95).setStrokeStyle(3, 0x8f7bc4, 1))
    this.content.add(card)

    card.add(
      label(this, 0, -278, arcade.available() ? `Arcade: ${arcade.status()}` : 'Arcade: playing locally', 13, '#bfe9ff', {
        origin: 0.5,
      }),
    )
    card.add(
      label(this, 0, -252, `Signed in as ${arcade.userLabel()}`, 12, '#cfc6e6', { origin: 0.5, alpha: 0.85 }),
    )

    this.slider(card, -190, 'Sound effects', data.settings.sfx, (value) => {
      update((current) => {
        current.settings.sfx = value
      })
      sound.setVolumes(value, save().settings.music)
    })
    this.slider(card, -90, 'Music', data.settings.music, (value) => {
      update((current) => {
        current.settings.music = value
      })
      sound.setVolumes(save().settings.sfx, value)
    })

    const toggles: Array<[string, boolean, () => void]> = [
      [
        `Sound: ${data.settings.muted ? 'muted' : 'on'}`,
        !data.settings.muted,
        () => {
          update((current) => {
            current.settings.muted = !current.settings.muted
          })
          sound.setMuted(save().settings.muted)
          this.render()
        },
      ],
      [
        `Camera shake: ${data.settings.shake ? 'on' : 'off'}`,
        data.settings.shake,
        () => {
          update((current) => {
            current.settings.shake = !current.settings.shake
          })
          this.render()
        },
      ],
      [
        `Reduced motion: ${data.settings.reducedMotion ? 'on' : 'off'}`,
        data.settings.reducedMotion,
        () => {
          update((current) => {
            current.settings.reducedMotion = !current.settings.reducedMotion
          })
          this.render()
        },
      ],
      [
        `Graphics: ${data.settings.quality}`,
        data.settings.quality !== 'low',
        () => {
          update((current) => {
            const index = QUALITIES.indexOf(current.settings.quality)
            current.settings.quality = QUALITIES[(index + 1) % QUALITIES.length]!
          })
          this.render()
        },
      ],
      [
        `Trajectory: ${GUIDES[data.settings.guide]}`,
        data.settings.guide === 0,
        () => {
          update((current) => {
            current.settings.guide = (current.settings.guide + 1) % GUIDES.length
          })
          this.render()
        },
      ],
    ]

    toggles.forEach(([title, on, action], index) => {
      card.add(
        button(this, 0, -10 + index * 74, title, action, {
          width: 520,
          height: 62,
          size: 15,
          fill: on ? '#3b2f5e' : '#2a2140',
        }),
      )
    })

    this.content.add(
      label(this, DESIGN_W / 2, 868, 'Progress saves automatically. The arcade syncs it when you are signed in.', 12, '#cfc6e6', {
        origin: 0.5,
        alpha: 0.7,
        wrap: 560,
      }),
    )
  }

  private slider(
    parent: Phaser.GameObjects.Container,
    y: number,
    title: string,
    value: number,
    onChange: (value: number) => void,
  ): void {
    const track = this.add.rectangle(40, y, 340, 12, 0x120c1e).setStrokeStyle(2, 0x8f7bc4, 0.8)
    const fill = this.add.rectangle(-130, y, 340 * value, 12, 0xffcf6a).setOrigin(0, 0.5)
    const handle = this.add.circle(-130 + 340 * value, y, 16, 0xffffff).setStrokeStyle(3, 0xffcf6a, 1)
    parent.add([track, fill, handle])
    parent.add(label(this, -250, y - 12, title, 14, '#ffffff', { fontStyle: 'bold' }))
    const readout = label(this, 250, y - 12, `${Math.round(value * 100)}%`, 14, '#ffe6a8', { origin: [1, 0] })
    parent.add(readout)

    const apply = (pointer: Phaser.Input.Pointer): void => {
      const local = Phaser.Math.Clamp((pointer.worldX - (DESIGN_W / 2 - 130)) / 340, 0, 1)
      fill.width = 340 * local
      handle.setX(-130 + 340 * local)
      readout.setText(`${Math.round(local * 100)}%`)
      onChange(local)
    }
    const hit = this.add.rectangle(40, y, 360, 54, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
    parent.add(hit)
    hit.on('pointerdown', apply)
    hit.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) apply(pointer)
    })
  }
}
