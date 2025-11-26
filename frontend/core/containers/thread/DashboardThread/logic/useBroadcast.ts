import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type {
  TBroadcastConfig,
  TBroadcastLayout,
  TDashboardBroadcastRoute,
  TEditFunc,
} from '~/spec'
import { SETTING_FIELD } from '~/stores/dashboard/constant'

import useHelper from './useHelper'

type TRet = TBroadcastConfig & {
  edit: TEditFunc
  broadcastLayout: TBroadcastLayout
  broadcastTab: TDashboardBroadcastRoute
  saving: boolean
  isTouched: boolean
  isArticleTouched: boolean
  changeEnable: (v: boolean) => void
  broadcastOnSave: (isArticle?: boolean) => void
  broadcastOnCancel: (isArticle?: boolean) => void
}

export default (): TRet => {
  const store = useDashboard()
  const { edit, isChanged, onSave } = useHelper()

  const isTouched = isChanged('broadcastLayout') || isChanged('broadcastBg')
  const isArticleTouched = isChanged('broadcastArticleLayout') || isChanged('broadcastArticleBg')

  const changeEnable = (v: boolean) => {
    store.commit({ broadcastEnable: v })
    setTimeout(() => onSave(SETTING_FIELD.BROADCAST_ENABLE))
  }

  const broadcastOnSave = (isArticle = false): void => {
    console.log('## broadcastOnSave: ', isArticle)
    store.commit({ saving: true })
    // const layoutKey = !isArticle
    //   ? SETTING_FIELD.BROADCAST_LAYOUT
    //   : SETTING_FIELD.BROADCAST_ARTICLE_LAYOUT
    // const bgKey = !isArticle ? SETTING_FIELD.BROADCAST_BG : SETTING_FIELD.BROADCAST_ARTICLE_BG

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
    //   ? SETTING_FIELD.BROADCAST_LAYOUT
    //   : SETTING_FIELD.BROADCAST_ARTICLE_LAYOUT
    // const bgKey = !isArticle ? SETTING_FIELD.BROADCAST_BG : SETTING_FIELD.BROADCAST_ARTICLE_BG

    // store.rollbackEdit(layoutKey)
    // store.rollbackEdit(bgKey)
  }

  return {
    edit,
    ...pick(
      [
        'broadcastLayout',
        'broadcastTab',
        'broadcastBg',
        'broadcastEnable',
        'broadcastArticleBg',
        'broadcastArticleLayout',
        'broadcastArticleEnable',
        'saving',
      ],
      store,
    ),
    isTouched,
    isArticleTouched,
    changeEnable,
    broadcastOnSave,
    broadcastOnCancel,
  }
}
