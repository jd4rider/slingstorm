import Phaser from 'phaser'
import { MATERIALS, type MaterialDef } from '../game/materials'
import type { MaterialId } from '../game/types'

/**
 * Every block face, crack, particle and UI flourish is painted into a canvas
 * texture at boot. Textures are seamless enough to tile at any block size, so a
 * 250x18 plank and a 22x118 column both keep their grain.
 */

export type Ctx = CanvasRenderingContext2D

function css(color: number | string, alpha = 1): string {
  const value = typeof color === 'string' ? Number.parseInt(color.replace('#', ''), 16) : color
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

function make(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, width, height)
  if (!texture) return
  const ctx = texture.getContext()
  draw(ctx)
  texture.refresh()
}

function noise(ctx: Ctx, width: number, height: number, count: number, color: string, size = 2, alpha = 0.2): void {
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  for (let index = 0; index < count; index += 1) {
    const x = Math.random() * width
    const y = Math.random() * height
    const s = size * (0.4 + Math.random())
    ctx.fillRect(x, y, s, s)
  }
  ctx.globalAlpha = 1
}

function drawWood(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color)
  ctx.fillRect(0, 0, 128, 128)
  for (let index = 0; index < 22; index += 1) {
    const y = Math.random() * 128
    ctx.strokeStyle = css(def.edge, 0.16 + Math.random() * 0.14)
    ctx.lineWidth = 1 + Math.random() * 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(42, y + 5, 86, y - 5, 128, y + 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.5
  for (let index = 0; index < 3; index += 1) {
    const x = Math.random() * 128
    const y = Math.random() * 128
    ctx.fillStyle = css(def.edge, 0.5)
    ctx.beginPath()
    ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  noise(ctx, 128, 128, 260, css(def.light), 2, 0.12)
}

function drawGlass(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color, 0.5)
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = css(0xffffff, 0.5)
  ctx.lineWidth = 3
  for (let index = -1; index < 4; index += 1) {
    ctx.beginPath()
    ctx.moveTo(index * 44, 0)
    ctx.lineTo(index * 44 + 40, 128)
    ctx.stroke()
  }
  ctx.strokeStyle = css(def.edge, 0.35)
  ctx.lineWidth = 1.5
  ctx.strokeRect(3, 3, 122, 122)
  noise(ctx, 128, 128, 120, '#ffffff', 2, 0.22)
}

function drawStone(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color)
  ctx.fillRect(0, 0, 128, 128)
  ctx.globalAlpha = 0.35
  for (let row = 0; row < 4; row += 1) {
    const offset = (row % 2) * 24
    for (let col = -1; col < 4; col += 1) {
      const x = col * 48 + offset
      const y = row * 32
      ctx.fillStyle = css(row % 2 === col % 2 ? def.light : def.edge, 0.4)
      ctx.fillRect(x + 2, y + 2, 44, 28)
    }
  }
  ctx.globalAlpha = 1
  noise(ctx, 128, 128, 420, css(def.edge), 3, 0.2)
  noise(ctx, 128, 128, 200, css(def.light), 2, 0.18)
}

function drawIce(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color, 0.82)
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = css('#ffffff', 0.6)
  ctx.lineWidth = 2
  for (let index = 0; index < 9; index += 1) {
    ctx.beginPath()
    const x = Math.random() * 128
    const y = Math.random() * 128
    ctx.moveTo(x, y)
    ctx.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 70)
    ctx.stroke()
  }
  ctx.fillStyle = css('#ffffff', 0.28)
  ctx.beginPath()
  ctx.moveTo(0, 96)
  ctx.lineTo(52, 40)
  ctx.lineTo(128, 74)
  ctx.lineTo(128, 128)
  ctx.lineTo(0, 128)
  ctx.fill()
}

function drawMetal(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color)
  ctx.fillRect(0, 0, 128, 128)
  for (let index = 0; index < 40; index += 1) {
    const y = Math.random() * 128
    ctx.strokeStyle = css(index % 2 ? def.light : def.edge, 0.18)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(128, y)
    ctx.stroke()
  }
  ctx.fillStyle = css(def.edge, 0.55)
  for (const x of [12, 116]) {
    for (const y of [12, 116]) {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = css(def.light, 0.22)
  ctx.fillRect(0, 0, 128, 18)
}

function drawRubber(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color)
  ctx.fillRect(0, 0, 128, 128)
  ctx.globalAlpha = 0.25
  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 128; x += 16) {
      ctx.fillStyle = css(def.edge, 0.5)
      ctx.beginPath()
      ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = css(def.light, 0.2)
  ctx.fillRect(0, 0, 128, 12)
}

function drawCrate(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color)
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = css(def.edge, 0.8)
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, 122, 122)
  ctx.lineWidth = 4
  for (const y of [42, 86]) {
    ctx.beginPath()
    ctx.moveTo(4, y)
    ctx.lineTo(124, y)
    ctx.stroke()
  }
  ctx.fillStyle = css(0xffe08a, 0.9)
  ctx.beginPath()
  ctx.moveTo(64, 26)
  ctx.lineTo(86, 52)
  ctx.lineTo(70, 52)
  ctx.lineTo(84, 78)
  ctx.lineTo(48, 48)
  ctx.lineTo(66, 48)
  ctx.closePath()
  ctx.fill()
  noise(ctx, 128, 128, 180, css(def.edge), 2, 0.14)
}

function drawCrystal(ctx: Ctx, def: MaterialDef): void {
  ctx.fillStyle = css(def.color, 0.85)
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = css('#ffffff', 0.5)
  ctx.lineWidth = 2
  for (let index = 0; index < 6; index += 1) {
    const x = 10 + index * 20
    ctx.beginPath()
    ctx.moveTo(x, 6)
    ctx.lineTo(x + 16, 64)
    ctx.lineTo(x - 4, 122)
    ctx.stroke()
  }
  ctx.fillStyle = css('#ffffff', 0.2)
  ctx.fillRect(0, 0, 128, 30)
}

const DRAWERS: Record<MaterialId, (ctx: Ctx, def: MaterialDef) => void> = {
  wood: drawWood,
  glass: drawGlass,
  stone: drawStone,
  ice: drawIce,
  metal: drawMetal,
  rubber: drawRubber,
  crate: drawCrate,
  crystal: drawCrystal,
}

function drawCrack(ctx: Ctx, branches: number, width: number): void {
  ctx.strokeStyle = 'rgba(20,14,28,0.75)'
  ctx.lineCap = 'round'
  for (let branch = 0; branch < branches; branch += 1) {
    ctx.lineWidth = width * (0.5 + Math.random() * 0.5)
    let x = 64 + (Math.random() - 0.5) * 30
    let y = 64 + (Math.random() - 0.5) * 30
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let step = 0; step < 4; step += 1) {
      x += (Math.random() - 0.5) * 56
      y += (Math.random() - 0.5) * 56
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function drawParticle(ctx: Ctx, kind: 'dot' | 'shard' | 'star' | 'ring' | 'smoke' | 'fluff'): void {
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = '#ffffff'
  if (kind === 'dot') {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.75)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(32, 32, 30, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'smoke') {
    const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,0.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(32, 32, 32, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'fluff') {
    ctx.beginPath()
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2
      const radius = 20 + Math.sin(index * 2.7) * 7
      const x = 32 + Math.cos(angle) * radius
      const y = 32 + Math.sin(angle) * radius
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'shard') {
    ctx.beginPath()
    ctx.moveTo(32, 4)
    ctx.lineTo(52, 44)
    ctx.lineTo(26, 60)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'star') {
    ctx.beginPath()
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 - Math.PI / 2
      const radius = index % 2 === 0 ? 30 : 11
      const x = 32 + Math.cos(angle) * radius
      const y = 32 + Math.sin(angle) * radius
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(32, 32, 24, 0, Math.PI * 2)
    ctx.stroke()
  }
}

export function buildTextures(scene: Phaser.Scene): void {
  for (const id of Object.keys(MATERIALS) as MaterialId[]) {
    const def = MATERIALS[id]
    make(scene, `block-${id}`, 128, 128, (ctx) => DRAWERS[id](ctx, def))
  }
  make(scene, 'crack-1', 128, 128, (ctx) => drawCrack(ctx, 3, 3))
  make(scene, 'crack-2', 128, 128, (ctx) => drawCrack(ctx, 7, 4.5))
  make(scene, 'p-dot', 64, 64, (ctx) => drawParticle(ctx, 'dot'))
  make(scene, 'p-shard', 64, 64, (ctx) => drawParticle(ctx, 'shard'))
  make(scene, 'p-star', 64, 64, (ctx) => drawParticle(ctx, 'star'))
  make(scene, 'p-ring', 64, 64, (ctx) => drawParticle(ctx, 'ring'))
  make(scene, 'p-smoke', 64, 64, (ctx) => drawParticle(ctx, 'smoke'))
  make(scene, 'p-fluff', 64, 64, (ctx) => drawParticle(ctx, 'fluff'))
  make(scene, 'soft', 64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(0,0,0,0.5)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  })
}

/** A painted fallback for any character sheet that is missing from public/art. */
export function buildCharacterFallback(scene: Phaser.Scene, key: string, color: string, deep: string, radius: number): void {
  const size = 128
  make(scene, key, size, size, (ctx) => {
    const centre = size / 2
    ctx.fillStyle = deep
    ctx.beginPath()
    ctx.arc(centre, centre, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(centre, centre, radius * 0.92, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.arc(centre - radius * 0.3, centre - radius * 0.35, radius * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#241a3a'
    ctx.beginPath()
    ctx.arc(centre - radius * 0.28, centre + radius * 0.05, radius * 0.15, 0, Math.PI * 2)
    ctx.arc(centre + radius * 0.28, centre + radius * 0.05, radius * 0.15, 0, Math.PI * 2)
    ctx.fill()
  })
}
