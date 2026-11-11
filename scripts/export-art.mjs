import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Packs the Blender renders in art/render into the spritesheets Phaser plays.
 *
 *   public/art/slingling-<type>-<action>.png   4 columns, 128px cells
 *   public/art/grumplet-<variant>-<action>.png
 *   public/art/slingshot.png                   512px still
 *
 * Frame counts mirror art/blender/characters.py and src/phaser/art.ts. Missing
 * renders are skipped so the game still runs from a clean checkout.
 */

const SLINGLINGS = ['pippin', 'boomkin', 'triplet', 'borebit', 'zing', 'frostpop', 'ricco', 'wrecker', 'flux', 'nimbus']
const GRUMPLETS = ['0', '1', '2', '3']
const ACTIONS = { idle: 8, blink: 4, launch: 6, happy: 6, scared: 4 }
const GRUMPLET_ACTIONS = { idle: 6, blink: 4, panic: 6 }
const COLUMNS = 4
const FRAME = 128

const root = dirname(new URL(import.meta.url).pathname)
const renderDir = join(root, '..', 'art', 'render')
const outDir = join(root, '..', 'public', 'art')
mkdirSync(outDir, { recursive: true })

let sheets = 0

function pack(dir, output, frameFiles) {
  const rows = Math.ceil(frameFiles.length / COLUMNS)
  const padded = [...frameFiles]
  while (padded.length < rows * COLUMNS) padded.push(frameFiles[frameFiles.length - 1])
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.sheet_')) unlinkSync(join(dir, name))
  }
  for (let index = 0; index < padded.length; index += 1) {
    execFileSync('ln', ['-sf', join(dir, padded[index]), join(dir, `.sheet_${String(index).padStart(2, '0')}.png`)])
  }
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      '1',
      '-i',
      join(dir, '.sheet_%02d.png'),
      '-frames:v',
      '1',
      '-vf',
      `scale=${FRAME}:${FRAME}:flags=lanczos,tile=${COLUMNS}x${rows}:padding=0:margin=0`,
      output,
    ])
    sheets += 1
    console.log(`sheet ${output.split('/').pop()}: ${frameFiles.length} frames (${COLUMNS}x${rows})`)
  } catch (error) {
    console.warn(`skipped ${output.split('/').pop()}: ${String(error).slice(0, 120)}`)
  }
}

function consume(baseDir, name, actions, prefix) {
  for (const [action, count] of Object.entries(actions)) {
    const dir = join(baseDir, name, action)
    if (!existsSync(dir)) continue
    const frames = readdirSync(dir)
      .filter((file) => file.endsWith('.png') && !file.startsWith('.sheet_'))
      .sort()
      .slice(0, count)
    if (frames.length === 0) continue
    pack(dir, join(outDir, `${prefix}${name}-${action}.png`), frames)
  }
}

for (const type of SLINGLINGS) consume(renderDir, type, ACTIONS, 'slingling-')
for (const variant of GRUMPLETS) consume(join(renderDir, 'grumplet'), variant, GRUMPLET_ACTIONS, 'grumplet-')

const shot = join(renderDir, 'slingshot', 'slingshot.png')
if (existsSync(shot)) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', shot, '-vf', 'scale=512:512:flags=lanczos', join(outDir, 'slingshot.png')])
  console.log('slingshot.png')
}

console.log(`exported ${sheets} animation sheets to public/art`)
