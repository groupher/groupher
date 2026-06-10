import { clone, equals, pick } from 'ramda'
import { createContext, use, useEffect, useMemo, useState } from 'react'

import { GRADIENT_PALETTE, GRADIENT_WALLPAPER, WALLPAPER_TYPE } from '~/const/wallpaper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTheme from '~/hooks/useTheme'
import {
  applyGradientPalette,
  composeGradientRecipeForRenderer,
  DEFAULT_WALLPAPER_TEXTURE_INTENSITY,
  GRADIENT_RENDERER,
  isMeshGradientRecipe,
} from '~/lib/wallpaperMesh'
import type { TGradientRecipe, TGradientRenderer, TWallpaperTexture } from '~/lib/wallpaperMesh'
import { toast } from '~/signal'
import type { TWallpaperData, TWallpaperType } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import { WALLPAPER_SAVABLE_STATE_KEYS, WALLPAPER_STATE_KEYS } from '~/stores/wallpaper/constant'
import {
  getWallpaperSavablePatch,
  pickWallpaperThemeState,
  toWallpaperThemePatch,
} from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TWallpaperPatch, TWallpaperThemeState } from '~/stores/wallpaper/spec'
import { revalidateCommunityCache } from '~/utils/revalidateCommunityCache'

import { TAB } from './constant'
import S from './schema'
import type { TTab } from './spec'
import useWallpaperPreview from './useWallpaperPreview'

const getInitialTab = (type: TWallpaperType): TTab => {
  switch (type) {
    case WALLPAPER_TYPE.PATTERN: {
      return TAB.PICTURES
    }
    case WALLPAPER_TYPE.UPLOAD: {
      return TAB.UPLOAD
    }
    default: {
      return TAB.GRADIENT
    }
  }
}

export type TWallpaperLogic = {
  tab: TTab
  loading: boolean
  // derived
  getWallpaper: () => TWallpaperData
  isTouched: boolean
  angleDraft: number
  // actions
  initRollback: () => void
  rollbackWallpaper: () => void
  onSave: () => void

  changeTab: (tab: TTab) => void
  changeAngle: (angle: number) => void
  removeWallpaper: () => void
  changeGradientWallpaper: (source: string) => void
  changeGradientRecipe: (gradient: TGradientRecipe) => void
  changeGradientRenderer: (renderer: TGradientRenderer) => void
  changePatternId: (patternId: string) => void
  changePatternTone: (patternTone: TWallpaperThemeState['patternTone']) => void
  changePatternWallpaper: (source: string) => void
  changeWallpaperType: (type: TWallpaperType) => void
  togglePattern: (hasPattern: boolean) => void
  toggleTexture: (hasTexture: boolean) => void
  changeBlurIntensity: (blurIntensity: number) => void
  changePatternIntensity: (patternIntensity: number) => void
  toggleShadow: (hasShadow: boolean) => void
  changeBrightness: (brightness: number) => void
  changeSaturation: (saturation: number) => void
  changeTexture: (texture: TWallpaperTexture) => void
  previewWallpaper: (patch: Partial<TWallpaperThemeState>) => void
  scheduleWallpaperPreview: (patch: Partial<TWallpaperThemeState>) => void
  flushWallpaperDraft: () => void
  clearPendingWallpaperDraft: () => void
  clearWallpaperPreview: () => void
}

export const LogicContext = createContext<TWallpaperLogic | null>(null)
LogicContext.displayName = 'WallpaperLogic'

const getAngleDraft = (state: TWallpaperThemeState): number => {
  const { gradient } = state
  if (!gradient) return 180

  if (gradient.renderer === GRADIENT_RENDERER.RADIAL) {
    return radialCenterToAngle(gradient.center)
  }
  if (gradient.renderer === GRADIENT_RENDERER.LINEAR || isMeshGradientRecipe(gradient)) {
    return gradient.angle
  }

  return 180
}

const RADIAL_DEFAULT_CENTER_DISTANCE = 0.22

const normalizeAngle = (angle: number): number => Math.round(((angle % 360) + 360) % 360)

const radialCenterToAngle = ({ x, y }: { x: number; y: number }): number => {
  const dx = x - 0.5
  const dy = y - 0.5

  if (Math.hypot(dx, dy) < 0.001) return 180

  return normalizeAngle((Math.atan2(dx, -dy) * 180) / Math.PI)
}

const radialCenterFromAngle = (
  angle: number,
  center: { x: number; y: number },
): { x: number; y: number } => {
  // Radial gradients reuse angle as focal-point direction. Keep the
  // existing center distance so the preset shape stays intact while rotating.
  const currentDistance = Math.hypot(center.x - 0.5, center.y - 0.5)
  const distance = currentDistance > 0.001 ? currentDistance : RADIAL_DEFAULT_CENTER_DISTANCE
  const rad = (normalizeAngle(angle) * Math.PI) / 180

  return {
    x: 0.5 + Math.sin(rad) * distance,
    y: 0.5 - Math.cos(rad) * distance,
  }
}

/**
 * Compose the patch for switching the active wallpaper gradient preset.
 *
 * In gradient mode it preserves the current renderer/shape and only applies the
 * new palette. From non-gradient modes it starts from the catalog recipe.
 *
 * @example
 * const patch = composeGradientWallpaperPatch(wallpaperState, 'stone_green')
 */
export const composeGradientWallpaperPatch = (
  wallpaper: Pick<TWallpaperThemeState, 'type' | 'gradient'>,
  source: string,
): Pick<TWallpaperThemeState, 'source' | 'type' | 'gradient'> => {
  const palette = GRADIENT_PALETTE[source] ?? GRADIENT_PALETTE.amber_mauve
  const initialGradient = GRADIENT_WALLPAPER[source] ?? GRADIENT_WALLPAPER.amber_mauve
  const gradient =
    wallpaper.type === WALLPAPER_TYPE.GRADIENT && wallpaper.gradient
      ? applyGradientPalette(wallpaper.gradient, palette)
      : composeGradientRecipeForRenderer(initialGradient, GRADIENT_RENDERER.LINEAR)

  return {
    source,
    type: WALLPAPER_TYPE.GRADIENT,
    gradient,
  }
}

const serializeWallpaperPatch = (patch: TWallpaperPatch): Record<string, unknown> => {
  const serialized = clone(patch) as Record<string, unknown>

  for (const theme of ['light', 'dark']) {
    const themePatch = serialized[theme] as Record<string, unknown> | undefined
    if (!themePatch) continue

    for (const key of ['gradient', 'texture']) {
      if (key in themePatch && themePatch[key] !== null && themePatch[key] !== undefined) {
        themePatch[key] = JSON.stringify(themePatch[key])
      }
    }
  }

  return serialized
}

export function useLogicValue(): TWallpaperLogic {
  const wallpaper$ = useWallpaperDomain()
  const liveWallpaper$ = wallpaper$.live$ ?? wallpaper$
  const community$ = useCommunity()
  const { getWallpaper } = useFullWallpaper()
  const { isDarkTheme } = useTheme()

  const { mutate } = useGraphQLClient()
  const [tab, setTab] = useState<TTab>(() =>
    getInitialTab(pickWallpaperThemeState(wallpaper$, isDarkTheme).type),
  )
  const [loading, setLoading] = useState(false)
  const wallpaperState = useMemo(
    () => pickWallpaperThemeState(wallpaper$, isDarkTheme),
    [isDarkTheme, wallpaper$.light, wallpaper$.dark],
  )
  const [angleDraft, setAngleDraft] = useState(() => getAngleDraft(wallpaperState))
  const {
    previewWallpaper,
    scheduleWallpaperPreview,
    flushWallpaperDraft,
    clearPendingWallpaperDraft,
    clearWallpaperPreview,
  } = useWallpaperPreview({
    state: wallpaperState,
    onCommit: (patch) => liveWallpaper$.commit(toWallpaperThemePatch(patch, isDarkTheme)),
  })

  const isTouched = useMemo((): boolean => {
    const original = pick(WALLPAPER_SAVABLE_STATE_KEYS, wallpaper$.original)
    const current = pick(WALLPAPER_SAVABLE_STATE_KEYS, wallpaper$)

    return !equals(clone(original), clone(current))
  }, [wallpaper$])

  useEffect(() => {
    setAngleDraft(getAngleDraft(wallpaperState))
  }, [wallpaperState])

  const initRollback = (): void =>
    liveWallpaper$.commit({ original: clone(pick(WALLPAPER_STATE_KEYS, liveWallpaper$)) })

  const commitWallpaperPatch = (patch: Partial<TWallpaperThemeState>): void => {
    flushWallpaperDraft()
    clearWallpaperPreview()
    liveWallpaper$.commit(toWallpaperThemePatch(patch, isDarkTheme))
  }

  const rollbackWallpaper = (): void => {
    clearPendingWallpaperDraft()
    clearWallpaperPreview()
    liveWallpaper$.commit({ ...liveWallpaper$.original })
  }

  const onSave = (): void => {
    flushWallpaperDraft()
    clearWallpaperPreview()
    setLoading(true)
    const community = community$.slug
    const wallpaper = serializeWallpaperPatch(getWallpaperSavablePatch(liveWallpaper$))
    const params = {
      community,
      wallpaper,
    }

    mutate(S.updateDashboardWallpaper, params)
      .then(async () => {
        await revalidateCommunityCache(community)
        toast('设置已保存')
        setLoading(false)
        initRollback()
      })
      .catch((err) => {
        console.error('## handle request error: ', err)
        setLoading(false)
      })
  }

  const changeTab = (tab: TTab): void => setTab(tab)
  const changeAngle = (angle: number): void => {
    setAngleDraft(angle)

    if (wallpaperState.gradient?.renderer === GRADIENT_RENDERER.LINEAR) {
      scheduleWallpaperPreview({ gradient: { ...wallpaperState.gradient, angle } })
      return
    }

    if (wallpaperState.gradient && isMeshGradientRecipe(wallpaperState.gradient)) {
      scheduleWallpaperPreview({ gradient: { ...wallpaperState.gradient, angle } })
      return
    }

    if (wallpaperState.gradient?.renderer === GRADIENT_RENDERER.RADIAL) {
      scheduleWallpaperPreview({
        gradient: {
          ...wallpaperState.gradient,
          center: radialCenterFromAngle(angle, wallpaperState.gradient.center),
        },
      })
      return
    }

    if (wallpaperState.gradient) return

    const fallback = GRADIENT_WALLPAPER.amber_mauve
    scheduleWallpaperPreview({ gradient: { ...fallback, angle } })
  }
  const removeWallpaper = (): void => {
    clearPendingWallpaperDraft()
    clearWallpaperPreview()
    liveWallpaper$.commit(
      toWallpaperThemePatch({ source: '', type: WALLPAPER_TYPE.NONE }, isDarkTheme),
    )
  }
  const changeGradientWallpaper = (source: string): void =>
    commitWallpaperPatch(composeGradientWallpaperPatch(wallpaperState, source))
  const changeGradientRecipe = (gradient: TGradientRecipe): void =>
    commitWallpaperPatch({ source: gradient.preset, type: WALLPAPER_TYPE.GRADIENT, gradient })
  const changeGradientRenderer = (renderer: TGradientRenderer): void => {
    const gradient = wallpaperState.gradient ?? GRADIENT_WALLPAPER.amber_mauve

    commitWallpaperPatch({
      source: gradient.preset,
      type: WALLPAPER_TYPE.GRADIENT,
      gradient: composeGradientRecipeForRenderer(gradient, renderer),
    })
  }
  const changePatternId = (patternId: string): void =>
    commitWallpaperPatch({ patternId, hasPattern: true })
  const changePatternTone = (patternTone: TWallpaperThemeState['patternTone']): void =>
    commitWallpaperPatch({ patternTone })
  const changePatternWallpaper = (source: string): void =>
    commitWallpaperPatch({ source, type: WALLPAPER_TYPE.PATTERN })

  const changeWallpaperType = (type: TWallpaperType): void => {
    commitWallpaperPatch({ type })
  }

  const togglePattern = (hasPattern: boolean): void => commitWallpaperPatch({ hasPattern })
  const toggleTexture = (hasTexture: boolean): void => {
    const texture =
      hasTexture && wallpaperState.texture.intensity === 0
        ? { ...wallpaperState.texture, intensity: DEFAULT_WALLPAPER_TEXTURE_INTENSITY }
        : wallpaperState.texture

    commitWallpaperPatch({ hasTexture, texture })
  }
  const changeBlurIntensity = (blurIntensity: number): void =>
    scheduleWallpaperPreview({ blurIntensity })
  const changePatternIntensity = (patternIntensity: number): void =>
    scheduleWallpaperPreview({ patternIntensity })
  const toggleShadow = (hasShadow: boolean): void => commitWallpaperPatch({ hasShadow })
  const changeBrightness = (brightness: number): void => scheduleWallpaperPreview({ brightness })
  const changeSaturation = (saturation: number): void => scheduleWallpaperPreview({ saturation })
  const changeTexture = (texture: TWallpaperTexture): void => scheduleWallpaperPreview({ texture })

  return {
    tab,
    loading,
    // drive
    getWallpaper,
    isTouched,
    angleDraft,
    //actions
    initRollback,
    rollbackWallpaper,
    onSave,
    changeTab,
    changeAngle,
    removeWallpaper,
    changeGradientWallpaper,
    changeGradientRecipe,
    changeGradientRenderer,
    changePatternId,
    changePatternTone,
    changePatternWallpaper,
    changeWallpaperType,
    togglePattern,
    toggleTexture,
    changeBlurIntensity,
    changePatternIntensity,
    toggleShadow,
    changeBrightness,
    changeSaturation,
    changeTexture,
    previewWallpaper,
    scheduleWallpaperPreview,
    flushWallpaperDraft,
    clearPendingWallpaperDraft,
    clearWallpaperPreview,
  }
}

export default function useLogic(): TWallpaperLogic {
  const value = use(LogicContext)
  if (!value) throw new Error('useLogic must be used within LogicProvider')

  return value
}
