import { clone, equals, pick } from 'ramda'
import { useMemo, useState } from 'react'
import { WALLPAPER_STATE_KEYS, WALLPAPER_TYPE } from '~/const/wallpaper'
import useFullWallpaper from '~/hooks/useFullWallpaper'

import useSubStore from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import { mutate } from '~/server'
import { closeDrawer, toast } from '~/signal'
import type { TWallpaperData, TWallpaperGradientDir, TWallpaperType } from '~/spec'
import { TAB } from './constant'
import S from './schema'
import type { TTab } from './spec'

type TRet = {
  tab: TTab
  loading: boolean
  // derived
  getWallpaper: () => TWallpaperData
  isTouched: boolean
  // actions
  initRollback: () => void
  rollbackWallpaper: () => void
  onSave: () => void
  close: () => void

  changeTab: (tab: TTab) => void
  changeDirection: (direction: TWallpaperGradientDir) => void
  removeWallpaper: () => void
  changeGradientWallpaper: (wallpaper: string) => void
  changePatternWallpaper: (wallpaper: string) => void
  changeCustomGradientWallpaper: () => void
  changeWallpaperType: (wallpaperType: TWallpaperType) => void
  confirmCustomColor: (customColorValue: string) => void
  togglePattern: (hasPattern: boolean) => void
  toggleBlur: (hasBlur: boolean) => void
  toggleShadow: (hasShadow: boolean) => void
}

export default (): TRet => {
  const store = useSubStore('wallpaper')
  const curCommunity = useViewingCommunity()
  const { getWallpaper } = useFullWallpaper()

  const [tab, setTab] = useState<TTab>(TAB.BUILDIN)
  const [loading, setLoading] = useState(false)

  const isTouched = useMemo((): boolean => {
    // @ts-expect-error
    const original = pick(WALLPAPER_STATE_KEYS, store.original)
    // @ts-expect-error
    const current = pick(WALLPAPER_STATE_KEYS, store)

    return !equals(clone(original), clone(current))
  }, [store])

  const close = (): void => {
    // store.rollbackEdit()
    closeDrawer()
  }

  // @ts-expect-error
  const initRollback = (): void => store.commit({ original: pick(WALLPAPER_STATE_KEYS, store) })
  const rollbackWallpaper = (): void => store.commit({ ...store.original })

  const onSave = (): void => {
    setLoading(true)
    const community = curCommunity.slug
    // @ts-expect-error
    const params = { community, ...pick(WALLPAPER_STATE_KEYS, store) }

    mutate(S.updateDashboardWallpaper, params)
      .then(() => {
        toast('设置已保存')
        setLoading(false)
        initRollback()
        closeDrawer()
      })
      .catch((err) => {
        console.error('## handle request error: ', err)
        setLoading(false)
      })
  }

  const changeTab = (tab: TTab): void => setTab(tab)
  const changeDirection = (direction: TWallpaperGradientDir): void => store.commit({ direction })
  const removeWallpaper = (): void =>
    store.commit({ wallpaper: '', wallpaperType: WALLPAPER_TYPE.NONE })
  const changeGradientWallpaper = (wallpaper: string): void =>
    store.commit({ wallpaper, wallpaperType: WALLPAPER_TYPE.GRADIENT })
  const changePatternWallpaper = (wallpaper: string): void =>
    store.commit({ wallpaper, wallpaperType: WALLPAPER_TYPE.PATTERN })

  const changeCustomGradientWallpaper = (): void => {
    store.commit({ wallpaper: '', wallpaperType: WALLPAPER_TYPE.CUSTOM_GRADIENT })
  }

  const changeWallpaperType = (wallpaperType: TWallpaperType): void => {
    store.commit({ wallpaperType })
  }

  const confirmCustomColor = (customColorValue: string): void => {
    store.commit({ customColorValue, wallpaperType: WALLPAPER_TYPE.CUSTOM_GRADIENT })
  }

  const togglePattern = (hasPattern: boolean): void => store.commit({ hasPattern })
  const toggleBlur = (hasBlur: boolean): void => store.commit({ hasBlur })
  const toggleShadow = (hasShadow: boolean): void => store.commit({ hasShadow })

  return {
    tab,
    loading,
    // drive
    getWallpaper,
    isTouched,
    //actions
    initRollback,
    rollbackWallpaper,
    onSave,
    close,
    changeTab,
    changeDirection,
    removeWallpaper,
    changeGradientWallpaper,
    changePatternWallpaper,
    changeCustomGradientWallpaper,
    changeWallpaperType,
    confirmCustomColor,
    togglePattern,
    toggleBlur,
    toggleShadow,
  }
}
