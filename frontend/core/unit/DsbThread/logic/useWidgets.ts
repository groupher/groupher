import { pick, reject } from 'ramda'

import type { TColorName, TEditFunc, TSizeSML, TThread } from '~/spec'
import useDsbShell from '~/stores/dsbShell/hooks'

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

/** Exposes widgets state and actions through the shared React hook boundary. */
export default function useWidgets(): TRet {
  const dsb$ = useDsbShell()
  const { isChanged, edit, isPending } = useHelper()

  const { widgetsThreads } = dsb$

  const threadOnChange = (checked: boolean, thread: TThread): void => {
    const newThreads = checked
      ? [...widgetsThreads, thread]
      : reject((t: TThread) => t === thread, widgetsThreads)

    dsb$.edit(FIELD.WIDGETS_THREADS, newThreads)
  }

  const isThreadTouched = isChanged(FIELD.WIDGETS_THREADS)

  const isPrimaryColorTouched = isChanged(FIELD.WIDGETS_PRIMARY_COLOR)
  const isSizeTouched = isChanged(FIELD.WIDGETS_SIZE)

  return {
    ...pick(['widgetsPrimaryColor', 'widgetsThreads', 'widgetsSize'], dsb$),
    saving: isPending,
    threadOnChange,
    isThreadTouched,
    isPrimaryColorTouched,
    isSizeTouched,
    edit,
  }
}
