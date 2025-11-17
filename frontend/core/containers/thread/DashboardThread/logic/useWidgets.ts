import { equals, pick, reject } from 'ramda'
import useSubStore from '~/hooks/useSubStore'
import type { TColorName, TEditFunc, TSizeSML, TThread, TWidgetType } from '~/spec'
import useHelper from './useHelper'

type TRet = {
  saving: boolean
  widgetsPrimaryColor: TColorName
  widgetsThreads: TThread[]
  widgetsSize: TSizeSML
  widgetsType: TWidgetType
  threadOnChange: (checked: boolean, thread: TThread) => void
  isThreadTouched: boolean
  isPrimaryColorTouched: boolean
  isSizeTouched: boolean
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

  const isThreadTouched = !equals(widgetsThreads, original.widgetsThreads)

  const isPrimaryColorTouched = isChanged('widgetsPrimaryColor')
  const isSizeTouched = isChanged('widgetsSize')

  return {
    ...pick(
      ['saving', 'widgetsPrimaryColor', 'widgetsThreads', 'widgetsSize', 'widgetsType'],
      store,
    ),
    threadOnChange,
    isThreadTouched,
    isPrimaryColorTouched,
    isSizeTouched,
    edit,
  }
}
