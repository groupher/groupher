import { useContext } from 'react'

import { ShellStyleContext } from '~/stores/shellStyle/context'

/** Exposes overlay dark state and actions through the shared React hook boundary. */
export default function useOverlayDark(): boolean {
  const value = useContext(ShellStyleContext)
  if (!value) throw new Error('useOverlayDark must be used within ShellStyleProvider')

  return value.overlayDark
}
