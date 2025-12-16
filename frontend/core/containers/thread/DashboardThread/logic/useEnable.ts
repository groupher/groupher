import useDashboard from '~/hooks/useDashboard'
import type { TEnableConf } from '~/spec'
import { FIELD } from '~/stores/dashboard/constant'

import useHelper from './useHelper'

type TRet = {
  enable: TEnableConf
  enableThread: (key: string, toggle: boolean) => void
}

export default (): TRet => {
  const store = useDashboard()
  const { onSave } = useHelper()

  const { enable } = store

  const enableThread = (key: string, toggle: boolean): void => {
    const patch = {
      ...enable,
      [key]: toggle,
    }

    store.commit({ enable: patch })
    setTimeout(() => onSave(FIELD.ENABLE))
  }

  return {
    enable,
    enableThread,
  }
}
