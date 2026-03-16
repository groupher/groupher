import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TBroadcastConf, TBroadcastLayout, TEditFunc } from '~/spec'
import { FIELD } from '../constant'

import useHelper from './useHelper'

type TRet = TBroadcastConf & {
  edit: TEditFunc
  broadcastLayout: TBroadcastLayout
  saving: boolean
  isTouched: boolean
  isArticleTouched: boolean
  changeEnable: (v: boolean) => void
  broadcastOnSave: (isArticle?: boolean) => void
  broadcastOnCancel: (isArticle?: boolean) => void
}

export default function useBroadcast(): TRet {
  const dsb$ = useDashboard()
  const { edit, isChanged, onSave } = useHelper()

  const isTouched = isChanged('broadcastLayout') || isChanged('broadcastBg')
  const isArticleTouched = isChanged('broadcastArticleLayout') || isChanged('broadcastArticleBg')

  const changeEnable = (v: boolean) => {
    dsb$.commit({ broadcastEnable: v })
    setTimeout(() => onSave(FIELD.BROADCAST_ENABLE))
  }

  const broadcastOnSave = (isArticle = false): void => {
    console.log('## broadcastOnSave: ', isArticle)
    dsb$.commit({ saving: true })
    // const layoutKey = !isArticle
    //   ? FIELD.BROADCAST_LAYOUT
    //   : FIELD.BROADCAST_ARTICLE_LAYOUT
    // const bgKey = !isArticle ? FIELD.BROADCAST_BG : FIELD.BROADCAST_ARTICLE_BG

    // store.onSave(layoutKey)
    // store.onSave(bgKey)

    // setTimeout(() => {
    //   store.mark({ saving: false })

    //   const original = {
    //     ...store.original,
    //     [layoutKey]: toJS(store[layoutKey]),
    //     [bgKey]: toJS(store[bgKey]),
    //   }
    //   store.mark({ original })
    // }, 1200)
  }

  const broadcastOnCancel = (isArticle = false): void => {
    console.log('## broadcastOnCancel: ', isArticle)
    // const layoutKey = !isArticle
    //   ? FIELD.BROADCAST_LAYOUT
    //   : FIELD.BROADCAST_ARTICLE_LAYOUT
    // const bgKey = !isArticle ? FIELD.BROADCAST_BG : FIELD.BROADCAST_ARTICLE_BG

    // store.rollbackEdit(layoutKey)
    // store.rollbackEdit(bgKey)
  }

  return {
    edit,
    ...pick(
      [
        'broadcastLayout',
        'broadcastBg',
        'broadcastEnable',
        'broadcastArticleBg',
        'broadcastArticleLayout',
        'broadcastArticleEnable',
        'saving',
      ],
      dsb$,
    ),
    isTouched,
    isArticleTouched,
    changeEnable,
    broadcastOnSave,
    broadcastOnCancel,
  }
}
