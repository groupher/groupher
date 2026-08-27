import type { TEnableConf } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

/** Exposes enable state and actions through the shared React hook boundary. */
export default function useEnable(): TEnableConf {
  const dsb$ = useDsb()

  return dsb$.enable
}
