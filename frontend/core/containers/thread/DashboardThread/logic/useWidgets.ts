import { equals, pick, reject } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TColorName, TEditFunc, TSizeSML, TThread, TWidgetType } from '~/spec'
import useHelper from './useHelper'

type TRet = {
  saving: boolean
  widgetsPrimaryColor: TColorName
  widgetsThreads: readonly TThread[]
  widgetsSize: TSizeSML
  widgetsType: TWidgetType
  threadOnChange: (checked: boolean, thread: TThread) => void
  isThreadTouched: boolean
  isPrimaryColorTouched: boolean
  isSizeTouched: boolean
  edit: TEditFunc
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { widgetsThreads, original } = dsb$

  const threadOnChange = (checked: boolean, thread: TThread): void => {
    const newThreads = checked
      ? [...widgetsThreads, thread]
      : reject((t: TThread) => t === thread, widgetsThreads)

    dsb$.commit({ widgetsThreads: newThreads })
  }

  const isThreadTouched = !equals(widgetsThreads, original.widgetsThreads)

  const isPrimaryColorTouched = isChanged('widgetsPrimaryColor')
  const isSizeTouched = isChanged('widgetsSize')

  return {
    ...pick(
      ['saving', 'widgetsPrimaryColor', 'widgetsThreads', 'widgetsSize', 'widgetsType'],
      dsb$,
    ),
    threadOnChange,
    isThreadTouched,
    isPrimaryColorTouched,
    isSizeTouched,
    edit,
  }
}
