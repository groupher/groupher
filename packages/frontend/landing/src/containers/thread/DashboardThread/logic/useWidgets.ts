import { useCallback } from 'react'
import { pick, reject } from 'ramda'

import type { TEditFunc } from '~/spec'
import type { TColorName, TWidgetType, TThread, TSizeSML } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

import { equals } from 'ramda'

type TRet = {
  saving: boolean
  widgetsPrimaryColor: TColorName
  widgetsThreads: TThread[]
  widgetsSize: TSizeSML
  widgetsType: TWidgetType
  threadOnChange: (checked: boolean, thread: TThread) => void
  getIsThreadTouched: () => boolean
  getIsPrimaryColorTouched: () => boolean
  getIsSizeTouched: () => boolean
  edit: TEditFunc
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { widgetsThreads, original } = store

  const threadOnChange = (checked: boolean, thread: TThread): void => {
    const newThreads = checked
      ? [...widgetsThreads, thread]
      : reject((t: TThread) => t === thread, widgetsThreads)

    store.commit({ widgetsThreads: newThreads })
  }

  const getIsThreadTouched = useCallback(() => {
    // @ts-ignore
    return !equals(widgetsThreads, original.widgetsThreads)
  }, [store])

  const getIsPrimaryColorTouched = useCallback(() => isChanged('widgetsPrimaryColor'), [store])
  const getIsSizeTouched = useCallback(() => isChanged('widgetsSize'), [store])

  return {
    ...pick(
      ['saving', 'widgetsPrimaryColor', 'widgetsThreads', 'widgetsSize', 'widgetsType'],
      store,
    ),
    threadOnChange,
    getIsThreadTouched,
    getIsPrimaryColorTouched,
    getIsSizeTouched,
    edit,
  }
}
