import type { ReactNode } from 'react'

import { FIELDS } from '~/constant/dsb-fields'
import type { TDsb, TDsbEditableFieldKey } from '~/spec'
import DsbProvider from '~/stores/dsb/provider'
import useDsbShell, { useDsbShellSession } from '~/stores/dsbShell/hooks'
import ThemePresetStoreProvider from '~/stores/ThemePreset/provider'

type TProps = {
  children: ReactNode
  initialData: TDsb
}

/** Projects the Dash editing session into public readers without writing Query cache in Demo. */
export default function DsbProjectionProvider({ children, initialData }: TProps) {
  const dashboard = useDsbShell()
  const { demoMode } = useDsbShellSession()
  const projectedData = demoMode
    ? {
        ...initialData,
        ...Object.fromEntries(
          (Object.keys(FIELDS) as TDsbEditableFieldKey[]).map((field) => [
            field,
            dashboard.original[field],
          ]),
        ),
      }
    : initialData

  return (
    <DsbProvider initData={projectedData as TDsb}>
      <ThemePresetStoreProvider initData={projectedData as TDsb}>
        {children}
      </ThemePresetStoreProvider>
    </DsbProvider>
  )
}
