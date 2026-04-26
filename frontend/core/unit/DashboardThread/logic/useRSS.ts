import { pick } from 'ramda'

import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  rssFeedType: string
  rssFeedCount: number
  saving: boolean
  isTouched: boolean
  edit: TEditFunc
  rssOnSave: () => void
  rssOnCancel: () => void
}

export default function useRSS(): TRet {
  const dsb$ = useDashboard()
  const { edit, isChanged } = useHelper()

  const isTouched = isChanged('rssFeedType') || isChanged('rssFeedCount')

  const rssOnSave = (): void => {
    dsb$.commit({ saving: true })
    console.log('## rssOnSave')
    // const { RSS_FEED_TYPE, RSS_FEED_COUNT } = FIELD

    // dsb$.onSave(RSS_FEED_TYPE)
    // dsb$.onSave(RSS_FEED_COUNT)

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
    // const { RSS_FEED_TYPE, RSS_FEED_COUNT } = FIELD

    // store.rollbackEdit(RSS_FEED_TYPE)
    // store.rollbackEdit(RSS_FEED_COUNT)
  }

  return {
    edit,
    ...pick(['rssFeedType', 'rssFeedCount', 'saving'], dsb$),
    isTouched,
    rssOnSave,
    rssOnCancel,
  }
}
