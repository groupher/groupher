import type { TCoverScene } from '../../../const/coverScenes'

export type THeightTier = 0 | 1 | 2 | 3

type TTileMotion = {
  movementOrder: number
  travelDistance: number
  imagePanDistance: number
}

export type TWallpaperTileFrameInput = {
  travelDistance: number
  imagePanDistance: number
  movementStart: number
  fadeRange: [number, number]
}

/** Resolves a tile's fade and pan at scroll progress, suppressing movement for reduced motion. */
export const getWallpaperTileFrame = (
  progress: number,
  motion: TWallpaperTileFrameInput,
  reducedMotion: boolean,
) => {
  const { fadeRange, travelDistance, movementStart, imagePanDistance } = motion
  const opacity = Math.min(
    1,
    Math.max(0, (fadeRange[1] - progress) / (fadeRange[1] - fadeRange[0])),
  )
  const staggered = Math.max(0, (progress - movementStart) / (1 - movementStart))

  return {
    opacity,
    y: reducedMotion ? 0 : -travelDistance * (0.06 * progress + 0.94 * staggered),
    pan: reducedMotion ? 0 : imagePanDistance * Math.min(1, progress / fadeRange[1]),
  }
}

const TIER_MOTION: Record<THeightTier, { fadeRange: [number, number]; imagePanScale: number }> = {
  0: { fadeRange: [0.7, 0.95], imagePanScale: 1.75 },
  1: { fadeRange: [0.45, 0.7], imagePanScale: 1.2 },
  2: { fadeRange: [0.2, 0.45], imagePanScale: 0.7 },
  3: { fadeRange: [0.015, 0.2], imagePanScale: 0.35 },
}

const hash = (value: string): number => {
  let result = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  }

  return result >>> 0
}

/** Creates stable per-scene variation so server rendering and hydration agree. */
export const getWallpaperTileMotion = (
  scenes: readonly TCoverScene[],
): Record<string, TTileMotion> => {
  const randomizedOrder = [...scenes].sort(
    (left, right) => hash(`${left.id}:order`) - hash(`${right.id}:order`),
  )
  const orderById = new Map(randomizedOrder.map((scene, index) => [scene.id, index]))

  return Object.fromEntries(
    scenes.map((scene) => [
      scene.id,
      {
        movementOrder: orderById.get(scene.id) ?? 0,
        travelDistance: 120 + (hash(`${scene.id}:distance`) % 121),
        imagePanDistance:
          ((scene.wallpaperPanAxis === 'y' ? 24 : 36) +
            (hash(`${scene.id}:image-pan`) % (scene.wallpaperPanAxis === 'y' ? 9 : 29))) *
          2 *
          (hash(`${scene.id}:image-direction`) % 2 === 0 ? 1 : -1),
      },
    ]),
  )
}

/** Applies height-tier timing and pan scale to a scene's stable motion settings. */
export const getWallpaperTileAnimation = (
  motion: TTileMotion,
  heightTier: THeightTier,
  sceneCount: number,
) => ({
  travelDistance: motion.travelDistance,
  imagePanDistance: motion.imagePanDistance * TIER_MOTION[heightTier].imagePanScale,
  movementStart: (motion.movementOrder / sceneCount) * 0.3,
  fadeRange: TIER_MOTION[heightTier].fadeRange,
})
