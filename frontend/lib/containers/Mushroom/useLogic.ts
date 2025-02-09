import { useSnapshot } from 'valtio'

import type { TScrollDirection } from '~/spec'
import { APP_VERSION } from '~/config'
// import useViewingCommunity from '~/hooks/useViewingCommunity'
// import useViewingThread from '~/hooks/useViewingThread'

import { Global } from '~/helper'

import store from './store'
// import S from './schema'

type TRet = {
  initAppVersion: () => void
  onPageScrollDirhange: (bodyScrollDirection: TScrollDirection) => void
  loadArticles: (page: number) => void
  syncURL: (page: number) => void
}

export default (): TRet => {
  const snap = useSnapshot(store)
  // const curCommunity = useViewingCommunity()
  // const curThread = useViewingThread()

  const onPageScrollDirhange = (bodyScrollDirection: TScrollDirection): void => {
    snap.commit({ bodyScrollDirection })
  }

  const loadArticles = (page = 1): void => {
    console.log('## TODO: load loadArticles: ', page)
    // const { curCommunity, userHasLogin, activeTag, activeCat, activeState, activeOrder } = store
    // store.updateResState(TYPE.RES_STATE.LOADING as TResState)
    // scrollToTop()

    // const filter = { page, size: 20, community: curCommunity.slug } as TPagedArticlesParams

    // if (activeTag?.slug) filter.articleTag = activeTag?.slug

    // if (activeCat) filter.cat = activeCat
    // if (activeState) filter.state = activeState
    // if (activeOrder) filter.order = activeOrder

    // sr71$.query(S.pagedPosts, { filter, userHasLogin })
  }

  // const searchParams2String = (obj): string => new URLSearchParams(obj).toString()
  // const getCurSearchParams = (): Record<any, any> =>
  //   Object.fromEntries(new URLSearchParams(window.location.search))

  const syncURL = (page: number): void => {
    console.log('## TODO: syncURL: ', page)
    // const { activeTag, activeCat, activeState, activeOrder } = store
    // const curSearchParams = getCurSearchParams()

    // // handle tag spec logic
    // activeTag?.slug ? (curSearchParams.tag = activeTag?.slug) : delete curSearchParams.tag
    // activeCat ? (curSearchParams.cat = activeCat.toLowerCase()) : delete curSearchParams.cat
    // activeState ? (curSearchParams.state = activeState.toLowerCase()) : delete curSearchParams.state
    // activeOrder ? (curSearchParams.order = activeOrder.toLowerCase()) : delete curSearchParams.order

    // // handle page number spec logic
    // page !== 1 ? (curSearchParams.page = page) : delete curSearchParams.page

    // doSyncRoute(searchParams2String(curSearchParams))
  }

  // const doSyncRoute = (queryString: string): void => {
  //   const mainPath = `/${curCommunity.slug}/${curThread}`

  //   if (!queryString) {
  //     Global.history.pushState(null, '', `${mainPath}`)
  //     return
  //   }

  //   Global.history.pushState(null, '', `${mainPath}?${queryString}`)
  // }

  const initAppVersion = (): void => {
    Global.appVersion = APP_VERSION || 'unknow'
  }

  return {
    initAppVersion,
    syncURL,
    onPageScrollDirhange,
    loadArticles,
  }
}
