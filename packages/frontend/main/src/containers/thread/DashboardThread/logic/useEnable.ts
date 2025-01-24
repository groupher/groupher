import type { TEnableConfig } from '~/spec'

import useSubState from '~/hooks/useSubStore'
import { SETTING_FIELD } from '~/stores/dashboard/constant'

import useHelper from './useHelper'

type TRet = {
  enable: TEnableConfig
  enableThread: (key: string, toggle: boolean) => void
}

export default (): TRet => {
  const store = useSubState('dashboard')
  const { onSave } = useHelper()

  const { enable } = store

  const enableThread = (key: string, toggle: boolean): void => {
    const patch = {
      ...enable,
      [key]: toggle,
    }

    store.commit({ enable: patch })
    setTimeout(() => onSave(SETTING_FIELD.ENABLE))
  }

  return {
    enable,
    enableThread,
  }
}
