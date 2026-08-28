import type { TEnableConf } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  enable: TEnableConf
  enableThread: (key: string, toggle: boolean) => void
}

/** Exposes enable state and actions through the shared React hook boundary. */
export default function useEnable(): TRet {
  const dsb$ = useDsb()
  const { onSave } = useHelper()

  const { enable } = dsb$

  const enableThread = (key: string, toggle: boolean): void => {
    const patch = {
      ...enable,
      [key]: toggle,
    }

    dsb$.editField(FIELD.ENABLE, patch)
    setTimeout(() => onSave(FIELD.ENABLE))
  }

  return {
    enable,
    enableThread,
  }
}
