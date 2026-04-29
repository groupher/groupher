import { pick, reject } from 'ramda'

import type { TColorName, TEditFunc, TSizeSML, TThread } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  saving: boolean
  widgetsPrimaryColor: TColorName
  widgetsThreads: readonly TThread[]
  widgetsSize: TSizeSML
  threadOnChange: (checked: boolean, thread: TThread) => void
  isThreadTouched: boolean
  isPrimaryColorTouched: boolean
  isSizeTouched: boolean
  edit: TEditFunc
}

export default function useWidgets(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { widgetsThreads } = dsb$

  const threadOnChange = (checked: boolean, thread: TThread): void => {
    const newThreads = checked
      ? [...widgetsThreads, thread]
      : reject((t: TThread) => t === thread, widgetsThreads)

    dsb$.editField(FIELD.WIDGETS_THREADS, newThreads)
  }

  const isThreadTouched = isChanged(FIELD.WIDGETS_THREADS)

  const isPrimaryColorTouched = isChanged(FIELD.WIDGETS_PRIMARY_COLOR)
  const isSizeTouched = isChanged(FIELD.WIDGETS_SIZE)

  return {
    ...pick(['saving', 'widgetsPrimaryColor', 'widgetsThreads', 'widgetsSize'], dsb$),
    threadOnChange,
    isThreadTouched,
    isPrimaryColorTouched,
    isSizeTouched,
    edit,
  }
}
