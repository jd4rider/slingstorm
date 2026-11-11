# Slingstorm

A portrait slingshot demolition game for Little Joy Arcade. The slingshot
stands on the left of a long ridge, the towers stand on the right, and every
shot travels left to right: pull a Slingling back down the ridge and let it go.

Phaser 3 · TypeScript · Vite · Matter physics.

## Run it

```bash
npm install
npm run dev        # http://localhost:5181
npm test           # 19 checks over all 500 levels
npm run build      # tsc --noEmit && vite build
```

## What is in here

- `src/game/` — the rules, with no Phaser in them: material tuning, the damage
  model, ballistic preview maths, scoring, objective progress, and the
  deterministic 500-level generator.
- `src/phaser/` — scenes, HUD, procedural textures and effects.
- `art/blender/characters.py` — the Blender renderer for every Slingling and
  Grumplet plus the slingshot. Renders transparent frames that
  `scripts/export-art.mjs` packs into 4-column spritesheets in `public/art/`.
- `tests/` — level validation runs the real Matter engine headlessly.

## The validation, specifically

`tests/levels.test.ts` builds all 500 levels and checks, for every one:

1. Every block and target is inside the playfield and above the ridge line.
2. No piece starts overlapping another, which is what makes a tower explode on
   load.
3. Ammunition covers the objective and the star thresholds are ordered.
4. Every target sits on a point a real ballistic arc from the pouch can reach
   (the ridge blocks shots, ordinary blocks do not).
5. The tower stands for 1.2 seconds with no shot: no block drifts more than
   12px, no target more than 40px, nothing falls out of the world.

That is a stability and reachability proof, not a solver: it does not claim a
specific sequence of shots clears every level, because Matter is not
deterministic across browsers. `tests/damage.test.ts` pins the material ratios
(glass and ice break in one clean hit, wood takes real work, stone takes more,
metal barely scratches), flies a real Matter body at four angles and checks the
drawn guide never drifts more than two pixels from it, and checks the preview
maths against the launch maths.

## Regenerating the artwork

```bash
blender -b --factory-startup --python art/blender/characters.py -- \
  --kind all --type all --action all --out art/render
npm run art
```

Renders land in `art/render/` (gitignored) and are packed into `public/art/`.
The game falls back to painted stand-ins for any missing sheet, so a clean
checkout still runs.
