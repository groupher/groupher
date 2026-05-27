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
import {
  parseMeshGradientValue,
  stringifyMeshGradientRecipe,
  type TWallpaperTexture,
} from '~/lib/wallpaperMesh'
import { toast } from '~/signal'
import type { TWallpaperData, TWallpaperGradientDir, TWallpaperType } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TWallpaperState } from '~/stores/wallpaper/spec'

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
    case WALLPAPER_TYPE.CUSTOM_GRADIENT: {
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
  directionDraft: TWallpaperGradientDir
  // actions
  initRollback: () => void
  rollbackWallpaper: () => void
  onSave: () => void

  changeTab: (tab: TTab) => void
  changeDirection: (direction: TWallpaperGradientDir) => void
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
  customColorValue: wallpaper$.customColorValue,
  source: wallpaper$.source,
  type: wallpaper$.type,
  hasPattern: wallpaper$.hasPattern,
  blurIntensity: wallpaper$.blurIntensity,
  hasShadow: wallpaper$.hasShadow,
  brightness: wallpaper$.brightness,
  saturation: wallpaper$.saturation,
  textureType: wallpaper$.textureType,
  textureStrength: wallpaper$.textureStrength,
  direction: wallpaper$.direction,
  bgSize: wallpaper$.bgSize,
})

const getDirectionDraft = (state: TWallpaperState): TWallpaperGradientDir => {
  if (state.type !== WALLPAPER_TYPE.CUSTOM_GRADIENT) return state.direction

  const meshRecipe = parseMeshGradientValue(state.customColorValue)

  return meshRecipe ? `${meshRecipe.flow}deg` : state.direction
}

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
      wallpaper$.customColorValue,
      wallpaper$.source,
      wallpaper$.type,
      wallpaper$.hasPattern,
      wallpaper$.blurIntensity,
      wallpaper$.hasShadow,
      wallpaper$.brightness,
      wallpaper$.saturation,
      wallpaper$.textureType,
      wallpaper$.textureStrength,
      wallpaper$.direction,
      wallpaper$.bgSize,
    ],
  )
  const [directionDraft, setDirectionDraft] = useState<TWallpaperGradientDir>(() =>
    getDirectionDraft(wallpaperState),
  )
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
    setDirectionDraft(getDirectionDraft(wallpaperState))
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
    const params = { community, ...pick(WALLPAPER_SAVABLE_STATE_KEYS, liveWallpaper$) }

    mutate(S.updateDashboardWallpaper, params)
      .then(() => {
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
  const changeDirection = (direction: TWallpaperGradientDir): void => {
    setDirectionDraft(direction)

    if (wallpaperState.type === WALLPAPER_TYPE.CUSTOM_GRADIENT) {
      const meshRecipe = parseMeshGradientValue(wallpaperState.customColorValue)
      const flow = Number.parseInt(String(direction), 10)

      if (meshRecipe && Number.isFinite(flow)) {
        scheduleWallpaperPreview({
          customColorValue: stringifyMeshGradientRecipe({ ...meshRecipe, flow }),
        })
        return
      }
    }

    scheduleWallpaperPreview({ direction })
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
  const changeTexture = ({ type, strength }: TWallpaperTexture): void =>
    scheduleWallpaperPreview({ textureType: type, textureStrength: strength })

  return {
    tab,
    loading,
    // drive
    getWallpaper,
    isTouched,
    directionDraft,
    //actions
    initRollback,
    rollbackWallpaper,
    onSave,
    changeTab,
    changeDirection,
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
