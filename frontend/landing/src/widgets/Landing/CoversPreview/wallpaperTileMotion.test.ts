import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

import { COVER_SCENES } from '../../../const/coverScenes'
import { LANDING_COVER_RANGE_KEY, prePaintLandingCoverScript } from '../../../landingCoverBootstrap'
import { LANDING_OPENING_SCROLL_KEY } from '../../../landingOpening'
import {
  getWallpaperTileAnimation,
  getWallpaperTileFrame,
  getWallpaperTileMotion,
  type THeightTier,
} from './wallpaperTileMotion'

const SCENE_ID = 'inspiration'
const SCROLL_RANGE = 1200

const getBootFrame = (
  progress: number,
  motion: ReturnType<typeof getWallpaperTileAnimation>,
  reducedMotion: boolean,
  savedProgress = progress,
) => {
  const styles = new Map<string, string>()
  const attributes = new Set<string>()
  const frames: Array<() => void> = []
  const scrollY = progress * SCROLL_RANGE
  const railAttributes: Record<string, string> = {
    'data-scene-id': SCENE_ID,
    'data-cover-fade-start': String(motion.fadeRange[0]),
    'data-cover-fade-end': String(motion.fadeRange[1]),
    'data-cover-travel': String(motion.travelDistance),
    'data-cover-movement-start': String(motion.movementStart),
    'data-cover-pan-distance': String(motion.imagePanDistance),
  }

  const document = {
    documentElement: {
      style: { setProperty: (key: string, value: string) => styles.set(key, value) },
      setAttribute: (key: string) => attributes.add(key),
      hasAttribute: (key: string) => attributes.has(key),
    },
    querySelector: () => ({
      getBoundingClientRect: () => ({ bottom: SCROLL_RANGE + 64 - scrollY }),
    }),
    querySelectorAll: () => [{ getAttribute: (key: string) => railAttributes[key] ?? null }],
  }
  const window = {
    performance: { getEntriesByType: () => [{ type: 'reload' }] },
    location: { pathname: '/' },
    sessionStorage: {
      getItem: (key: string) => {
        if (key === `${LANDING_OPENING_SCROLL_KEY}/`) return String(savedProgress * SCROLL_RANGE)
        if (key === `${LANDING_COVER_RANGE_KEY}/`) return String(SCROLL_RANGE)
        return null
      },
    },
    innerHeight: SCROLL_RANGE,
    scrollY,
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
  }

  runInNewContext(prePaintLandingCoverScript, { document, window })
  frames.shift()?.()

  return {
    opacity: Number(styles.get(`--landing-cover-boot-opacity-${SCENE_ID}`)),
    visibility: styles.get(`--landing-cover-boot-visibility-${SCENE_ID}`),
    y: Number.parseFloat(styles.get(`--landing-cover-boot-y-${SCENE_ID}`) ?? ''),
    pan: Number.parseFloat(styles.get(`--landing-cover-boot-pan-${SCENE_ID}`) ?? ''),
    frames,
    styles,
  }
}

describe('cover scroll frame', () => {
  it('keeps the prepaint frame aligned with the interactive motion model', () => {
    const sceneMotion = getWallpaperTileMotion(COVER_SCENES)[SCENE_ID]

    for (const tier of [0, 1, 2, 3] as THeightTier[]) {
      const motion = getWallpaperTileAnimation(sceneMotion, tier, COVER_SCENES.length)
      for (const reducedMotion of [false, true]) {
        for (const progress of [0, 0.05, 0.2, 0.4, 0.65, 0.9, 1]) {
          const boot = getBootFrame(progress, motion, reducedMotion)
          const interactive = getWallpaperTileFrame(progress, motion, reducedMotion)

          expect(boot.opacity).toBeCloseTo(interactive.opacity)
          expect(boot.y).toBeCloseTo(interactive.y)
          expect(boot.pan).toBeCloseTo(interactive.pan)
          expect(boot.visibility).toBe(interactive.opacity === 0 ? 'hidden' : 'visible')
        }
      }
    }
  })

  it('uses saved scroll only for the first frame and keeps painting until activation', () => {
    const sceneMotion = getWallpaperTileMotion(COVER_SCENES)[SCENE_ID]
    const motion = getWallpaperTileAnimation(sceneMotion, 0, COVER_SCENES.length)
    const boot = getBootFrame(0, motion, false, 0.5)
    expect(boot.opacity).toBeCloseTo(getWallpaperTileFrame(0.5, motion, false).opacity)

    boot.frames.shift()?.()
    expect(Number(boot.styles.get(`--landing-cover-boot-opacity-${SCENE_ID}`))).toBeCloseTo(
      getWallpaperTileFrame(0, motion, false).opacity,
    )

    for (let frame = 0; frame < 181; frame += 1) boot.frames.shift()?.()
    expect(boot.frames).toHaveLength(1)
  })
})
