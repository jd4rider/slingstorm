import Phaser from 'phaser'
import { sound } from '../core/audio'
import { DESIGN_H, DESIGN_W } from './layout'

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif'
export const DISPLAY = '"Arial Black", "Trebuchet MS", "Segoe UI", sans-serif'

/** Type is authored at design size and scaled up so it stays legible on a phone. */
export const UI_SCALE = 1.3

export function hex(value: string): number {
  return Phaser.Display.Color.HexStringToColor(value).color
}

export function mix(from: string, to: string, amount: number): string {
  const a = Phaser.Display.Color.HexStringToColor(from)
  const b = Phaser.Display.Color.HexStringToColor(to)
  const ratio = Math.max(0, Math.min(1, amount))
  const component = (x: number, y: number): string =>
    Math.round(x * (1 - ratio) + y * ratio)
      .toString(16)
      .padStart(2, '0')
  return `#${component(a.red, b.red)}${component(a.green, b.green)}${component(a.blue, b.blue)}`
}

export interface TextOptions {
  origin?: number | [number, number]
  align?: 'left' | 'center' | 'right'
  fontStyle?: string
  wrap?: number
  alpha?: number
  lineSpacing?: number
  fontFamily?: string
  letterSpacing?: number
  shadow?: boolean
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 20,
  color = '#ffffff',
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, {
    fontFamily: options.fontFamily ?? FONT,
    fontSize: `${Math.round(size * UI_SCALE)}px`,
    color,
    align: options.align ?? 'left',
    fontStyle: options.fontStyle,
    lineSpacing: options.lineSpacing,
    resolution: 2,
    wordWrap: options.wrap ? { width: options.wrap, useAdvancedWrap: true } : undefined,
  })
  if (options.shadow) text.setShadow(0, 3, '#00000066', 4)
  if (options.origin !== undefined) {
    if (Array.isArray(options.origin)) text.setOrigin(options.origin[0], options.origin[1])
    else text.setOrigin(options.origin, options.origin)
  }
  if (options.alpha !== undefined) text.setAlpha(options.alpha)
  if (options.letterSpacing !== undefined) text.setLetterSpacing(options.letterSpacing)
  return text
}

export function display(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 48,
  color = '#ffffff',
  origin = 0.5,
): Phaser.GameObjects.Text {
  return label(scene, x, y, content, size, color, {
    origin,
    fontFamily: DISPLAY,
    fontStyle: 'bold',
    letterSpacing: 1,
    shadow: true,
  })
}

export interface PanelOptions {
  radius?: number
  fill?: string
  side?: string
  alpha?: number
  raised?: number
  stroke?: string
  strokeAlpha?: number
  shadow?: boolean
  highlight?: boolean
}

export function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  options: PanelOptions = {},
): void {
  const radius = options.radius ?? 26
  const raised = options.raised ?? 5
  const fill = hex(options.fill ?? '#2b2140')
  const side = hex(options.side ?? '#150f24')
  if (options.shadow !== false) {
    graphics.fillStyle(0x000000, 0.28)
    graphics.fillRoundedRect(3, raised + 7, width, height, radius)
  }
  graphics.fillStyle(side, 1)
  graphics.fillRoundedRect(0, raised, width, height, radius)
  graphics.fillStyle(fill, options.alpha ?? 1)
  graphics.fillRoundedRect(0, 0, width, height, radius)
  if (options.highlight !== false) {
    graphics.fillStyle(0xffffff, 0.08)
    graphics.fillRoundedRect(6, 6, width - 12, Math.min(22, height * 0.34), radius * 0.7)
  }
  if (options.stroke) {
    graphics.lineStyle(3, hex(options.stroke), options.strokeAlpha ?? 0.9)
    graphics.strokeRoundedRect(0, 0, width, height, radius)
  }
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: PanelOptions = {},
): Phaser.GameObjects.Container {
  const graphics = scene.add.graphics()
  drawPanel(graphics, width, height, options)
  const container = scene.add.container(x, y, [graphics])
  container.setSize(width, height)
  return container
}

export interface ButtonOptions {
  width?: number
  height?: number
  fill?: string
  side?: string
  textColor?: string
  size?: number
  icon?: string
  disabled?: boolean
  subtitle?: string
  stroke?: string
  radius?: number
}

/**
 * Every button in the game goes through here, so hover, press, sound and the
 * disabled state are always the same and never silently missing.
 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 420
  const height = options.height ?? 88
  const graphics = scene.add.graphics()
  const draw = (raised: number, fill: string, side: string): void => {
    graphics.clear()
    drawPanel(graphics, width, height, {
      fill,
      side,
      radius: options.radius ?? 26,
      raised,
      stroke: options.stroke,
    })
  }
  const fill = options.fill ?? '#3b2f5e'
  const side = options.side ?? '#191129'
  draw(5, fill, side)

  const content = options.icon ? `${options.icon}  ${text}` : text
  // The container sits on its own centre, so the panel artwork and the hit
  // area are both offset by half their size. Without this every button renders
  // down and to the right of where the caller asked for it.
  const title = label(scene, 0, options.subtitle ? -12 : 0, content, options.size ?? 24, options.textColor ?? '#ffffff', {
    origin: 0.5,
    fontStyle: 'bold',
    fontFamily: DISPLAY,
    letterSpacing: 0.6,
  })
  graphics.setPosition(-width / 2, -height / 2)
  const children: Phaser.GameObjects.GameObject[] = [graphics, title]
  if (options.subtitle) {
    children.push(label(scene, 0, 18, options.subtitle, 12, '#cfc6e6', { origin: 0.5, alpha: 0.85 }))
  }
  const container = scene.add.container(x, y, children)
  container.setSize(width, height)
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  )

  if (options.disabled) {
    container.setAlpha(0.45)
    return container
  }

  container.on('pointerover', () => {
    draw(7, mix(fill, '#ffffff', 0.12), side)
    scene.tweens.add({ targets: container, scale: 1.03, duration: 110, ease: 'Quad.out' })
  })
  container.on('pointerout', () => {
    draw(5, fill, side)
    scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Quad.out' })
  })
  container.on('pointerdown', () => {
    draw(1, mix(fill, '#000000', 0.12), side)
    container.setScale(0.98)
  })
  container.on('pointerup', () => {
    draw(5, fill, side)
    container.setScale(1)
    sound.click()
    onClick()
  })
  return container
}

export function starRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  stars: number,
  size = 26,
  spacing = 30,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  for (let index = 0; index < 3; index += 1) {
    const star = scene.add
      .text((index - 1) * spacing, 0, '\u2605', {
        fontFamily: DISPLAY,
        fontSize: `${size}px`,
        color: index < stars ? '#ffd85c' : '#4a3f66',
      })
      .setOrigin(0.5)
    container.add(star)
  }
  return container
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function fadeIn(scene: Phaser.Scene, color: [number, number, number] = [12, 10, 24]): void {
  scene.cameras.main.fadeIn(220, color[0], color[1], color[2])
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object): void {
  scene.cameras.main.fadeOut(200, 10, 8, 20)
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data)
  })
}

void DESIGN_W
void DESIGN_H
