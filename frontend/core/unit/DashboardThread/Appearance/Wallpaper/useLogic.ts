import { clone, equals, pick } from 'ramda'
import {
  createContext,
  createElement,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  WALLPAPER_SAVABLE_STATE_KEYS,
  WALLPAPER_STATE_KEYS,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TWallpaperTexture } from '~/lib/wallpaperMesh'
import { toast } from '~/signal'
import type { TWallpaperData, TWallpaperType } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TWallpaperState } from '~/stores/wallpaper/spec'
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
    case WALLPAPER_TYPE.MESH: {
      return TAB.DIY
    }
    default: {
      return TAB.GRADIENT
    }
  }
}

type TRet = {
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
  changePatternWallpaper: (source: string) => void
  changeWallpaperType: (type: TWallpaperType) => void
  togglePattern: (hasPattern: boolean) => void
  changeBlurIntensity: (blurIntensity: number) => void
  toggleShadow: (hasShadow: boolean) => void
  changeBrightness: (brightness: number) => void
  changeSaturation: (saturation: number) => void
  changeTexture: (texture: TWallpaperTexture) => void
  previewWallpaper: (patch: Partial<TWallpaperState>) => void
  scheduleWallpaperPreview: (patch: Partial<TWallpaperState>) => void
  flushWallpaperDraft: () => void
  clearPendingWallpaperDraft: () => void
  clearWallpaperPreview: () => void
}

const LogicContext = createContext<TRet | null>(null)
LogicContext.displayName = 'WallpaperLogic'

const getWallpaperState = (wallpaper$: ReturnType<typeof useWallpaperDomain>): TWallpaperState => ({
  customWallpaper: wallpaper$.customWallpaper,
  source: wallpaper$.source,
  type: wallpaper$.type,
  hasPattern: wallpaper$.hasPattern,
  gradientDeg: wallpaper$.gradientDeg,
  blurIntensity: wallpaper$.blurIntensity,
  hasShadow: wallpaper$.hasShadow,
  brightness: wallpaper$.brightness,
  saturation: wallpaper$.saturation,
  mesh: wallpaper$.mesh,
  texture: wallpaper$.texture,
  bgSize: wallpaper$.bgSize,
})

const getAngleDraft = (state: TWallpaperState): number =>
  state.type === WALLPAPER_TYPE.MESH && state.mesh ? state.mesh.flow : state.gradientDeg

function useLogicValue(): TRet {
  const wallpaper$ = useWallpaperDomain()
  const liveWallpaper$ = wallpaper$.live$ ?? wallpaper$
  const community$ = useCommunity()
  const { getWallpaper } = useFullWallpaper()

  const { mutate } = useGraphQLClient()
  const [tab, setTab] = useState<TTab>(() => getInitialTab(wallpaper$.type))
  const [loading, setLoading] = useState(false)
  const wallpaperState = useMemo(
    () => getWallpaperState(wallpaper$),
    [
      wallpaper$.customWallpaper,
      wallpaper$.source,
      wallpaper$.type,
      wallpaper$.hasPattern,
      wallpaper$.gradientDeg,
      wallpaper$.blurIntensity,
      wallpaper$.hasShadow,
      wallpaper$.brightness,
      wallpaper$.saturation,
      wallpaper$.mesh,
      wallpaper$.texture,
      wallpaper$.bgSize,
    ],
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
    onCommit: (patch) => liveWallpaper$.commit(patch),
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
    liveWallpaper$.commit({ original: pick(WALLPAPER_STATE_KEYS, liveWallpaper$) })

  const commitWallpaperPatch = (patch: Partial<TWallpaperState>): void => {
    flushWallpaperDraft()
    clearWallpaperPreview()
    liveWallpaper$.commit(patch)
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
    const wallpaperFields = pick(WALLPAPER_SAVABLE_STATE_KEYS, liveWallpaper$)
    const params = {
      community,
      ...wallpaperFields,
      mesh: wallpaperFields.mesh ? JSON.stringify(wallpaperFields.mesh) : null,
      texture: JSON.stringify(wallpaperFields.texture),
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

    if (wallpaperState.type === WALLPAPER_TYPE.MESH && wallpaperState.mesh) {
      scheduleWallpaperPreview({ mesh: { ...wallpaperState.mesh, flow: angle } })
      return
    }

    scheduleWallpaperPreview({ gradientDeg: angle })
  }
  const removeWallpaper = (): void => {
    clearPendingWallpaperDraft()
    clearWallpaperPreview()
    liveWallpaper$.commit({ source: '', type: WALLPAPER_TYPE.NONE })
  }
  const changeGradientWallpaper = (source: string): void =>
    commitWallpaperPatch({ source, type: WALLPAPER_TYPE.GRADIENT })
  const changePatternWallpaper = (source: string): void =>
    commitWallpaperPatch({ source, type: WALLPAPER_TYPE.PATTERN })

  const changeWallpaperType = (type: TWallpaperType): void => {
    commitWallpaperPatch({ type })
  }

  const togglePattern = (hasPattern: boolean): void => commitWallpaperPatch({ hasPattern })
  const changeBlurIntensity = (blurIntensity: number): void =>
    scheduleWallpaperPreview({ blurIntensity })
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
    changePatternWallpaper,
    changeWallpaperType,
    togglePattern,
    changeBlurIntensity,
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

export function WallpaperLogicProvider({ children }: { children: ReactNode }) {
  const value = useLogicValue()

  return createElement(LogicContext.Provider, { value }, children)
}

export default function useLogic(): TRet {
  const value = use(LogicContext)
  if (!value) throw new Error('useLogic must be used within WallpaperLogicProvider')

  return value
}
