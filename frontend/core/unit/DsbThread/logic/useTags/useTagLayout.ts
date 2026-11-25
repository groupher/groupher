import useDsbShell from '~/stores/dsbShell/hooks'

import useHelper from '../useHelper'
import useTouch from '../useHelper/useTouch'

/** Exposes the two Dsb-owned tag presentation settings outside the Tags editor session. */
export default function useTagLayout() {
  const dsb$ = useDsbShell()
  const { edit } = useHelper()
  const { isChanged } = useTouch()

  return {
    edit,
    tagLayout: dsb$.tagLayout,
    inlineTagLayout: dsb$.inlineTagLayout,
    tagLayoutTouched: isChanged('tagLayout'),
    inlineTagLayoutTouched: isChanged('inlineTagLayout'),
  }
}
