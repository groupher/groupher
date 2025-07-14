import { useSnapshot } from 'valtio'

import { pick, keys, values, forEach, includes, mergeRight } from 'ramda'

import type { TDirection } from '~/spec'
import EVENT from '~/const/event'
import { ARTICLE_THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import { lockPage, unlockPage, toggleGlobalBlur } from '~/dom'
import { send } from '~/signal'

import type { TStore, TSwipeOption } from './spec'
import store from './valtioStore'

import PubSub from '~/utils/pubsub'

type TRet = {
  initPubSub: () => void
  closeDrawer: () => void
  onSwipedYHandler: (
    ev,
    setSwipeUpY: (i: number) => void,
    setSwipeDownY: (i: number) => void,
    ignoreSwipeAviliable?: boolean,
  ) => void

  onSwipingYHandler: (
    ev,
    setSwipeUpY: (i: number) => void,
    setSwipeDownY: (i: number) => void,
    ignoreSwipeAviliable?: boolean,
  ) => void
  toggleSwipeAviliable: (type: TDirection, bool: boolean) => void
  resetSwipeAviliable: () => void
  toggleHeaderTextVisiable: (bool: boolean) => void
} & TStore

const defaultOptions: TSwipeOption = { direction: 'bottom', position: 'M' }

export default (): TRet => {
  const snap = useSnapshot(store)

  const onSwipedYHandler = (
    ev,
    setSwipeUpY: (i: number) => void,
    setSwipeDownY: (i: number) => void,
    ignoreSwipeAviliable = false,
  ): void => {
    console.log('# TODO: ', ev, setSwipeUpY, setSwipeDownY, ignoreSwipeAviliable)
  }

  const onSwipingYHandler = (
    ev,
    setSwipeUpY: (i: number) => void,
    setSwipeDownY: (i: number) => void,
    ignoreSwipeAviliable = false,
  ): void => {
    console.log('## TODO: ', ev, setSwipeUpY, setSwipeDownY, ignoreSwipeAviliable)
  }

  const resetSwipeAviliable = (): void => {
    snap.commit({ swipeDownAviliable: true, swipeUpAviliable: false })
  }

  const toggleSwipeAviliable = (type: TDirection, bool: boolean): void => {
    console.log('## TODO toggleSwipeAviliable: ', type, bool)
    // type === 'down'
    //   ? store.mark({ swipeDownAviliable: bool })
    //   : store.mark({ swipeUpAviliable: bool })
  }

  const toggleHeaderTextVisiable = (bool: boolean): void => {
    snap.commit({ showHeaderText: bool })
  }

  const closeDrawer = (): void => {
    // slf.restorePreviousURLIfNeed()
    snap.commit({ visible: false, canBeClose: false, type: null })
    unlockPage()

    // force call MDEditor's componentWillUnmount to store the draft
    // wait until drawer move out of the screean
    setTimeout(() => {
      send(EVENT.DRAWER.AFTER_CLOSE)
      console.log('## TODO: resetViewing')
      // store.resetViewing()

      // 偶尔会有没有关闭的情况，确保关闭模糊
      toggleGlobalBlur(false)
    }, 200)
  }

  const openDrawer = ({ type, data, options = {} }) => {
    const thread = data?.meta?.thread?.toLowerCase()
    const { DRAWER } = TYPE

    if (includes(thread, values(ARTICLE_THREAD))) {
      // article
      // slf.setViewing({ [thread]: data, viewingThread: thread })
      console.log('## TODO: set viewing')
    }

    // @ts-ignore
    snap.commit({ visible: true, type, options: mergeRight(defaultOptions, options) })
    lockPage()

    // const isMobile = false
    // if (isMobile) {
    //   slf.canBeClose = false
    // }

    if (
      type !== DRAWER.ACCOUNT_EDIT &&
      type !== DRAWER.C11N_SETTINGS &&
      type !== DRAWER.DASHBOARD_DESC &&
      type !== DRAWER.CUSTOM_BG_EDITOR &&
      type !== DRAWER.G_EDITOR &&
      type !== DRAWER.CREATE_TAG &&
      type !== DRAWER.PASSPORT_EDITOR &&
      type !== DRAWER.EDIT_TAG &&
      type !== DRAWER.SEARCH_PANEL &&
      type !== DRAWER.LIST_USERS
    ) {
      // slf.markPreviewURLIfNeed(data)
    }
  }

  const initPubSub = () => {
    const EVENTS = values(EVENT.DRAWER)

    forEach((event) => {
      PubSub.subscribe(event, (event, data) => {
        // console.log('## pubsub event: ', event)
        // console.log('## pubsub data: ', data)
        if (event === EVENT.DRAWER.OPEN) {
          console.log('## drawer open !!!!: ', data)
          openDrawer(data)
        }
        if (event === EVENT.DRAWER.CLOSE) {
          closeDrawer()
        }
      })
    }, EVENTS)
  }
  // forEach((event) => {
  // PubSub.subscribe(event, (event, data) => {
  // })
  // }, this.receive)

  return {
    ...pick(keys(snap), snap),
    initPubSub,
    closeDrawer,
    onSwipedYHandler,
    onSwipingYHandler,
    toggleSwipeAviliable,
    resetSwipeAviliable,
    toggleHeaderTextVisiable,
  }
}
