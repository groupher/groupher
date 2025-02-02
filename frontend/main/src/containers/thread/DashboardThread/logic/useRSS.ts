import { useCallback } from 'react'
import { pick } from 'ramda'

import type { TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  rssFeedType: string
  rssFeedCount: number
  saving: boolean
  getIsTouched: () => boolean
  edit: TEditFunc
  rssOnSave: () => void
  rssOnCancel: () => void
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { edit, isChanged } = useHelper()

  const getIsTouched = useCallback(
    () => isChanged('rssFeedType') || isChanged('rssFeedCount'),
    [store],
  )

  const rssOnSave = (): void => {
    store.commit({ saving: true })
    console.log('## rssOnSave')
    // const { RSS_FEED_TYPE, RSS_FEED_COUNT } = SETTING_FIELD

    // store.onSave(RSS_FEED_TYPE)
    // store.onSave(RSS_FEED_COUNT)

    // setTimeout(() => {
    //   store.mark({ saving: false })

    //   const original = {
    //     ...store.original,
    //     [RSS_FEED_TYPE]: toJS(store[RSS_FEED_TYPE]),
    //     [RSS_FEED_COUNT]: toJS(store[RSS_FEED_COUNT]),
    //   }

    //   store.mark({ original })
    // }, 1200)
  }

  const rssOnCancel = (): void => {
    console.log('## rssOnCancel')
    // const { RSS_FEED_TYPE, RSS_FEED_COUNT } = SETTING_FIELD

    // store.rollbackEdit(RSS_FEED_TYPE)
    // store.rollbackEdit(RSS_FEED_COUNT)
  }

  return {
    edit,
    ...pick(['rssFeedType', 'rssFeedCount', 'saving'], store),
    getIsTouched,
    rssOnSave,
    rssOnCancel,
  }
}
