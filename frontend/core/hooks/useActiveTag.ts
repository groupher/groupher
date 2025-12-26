import useGeneral from '~/hooks/useGeneral'
import type { TTag } from '~/spec'

export default (): TTag => {
  const store = useGeneral()

  return store.activeTag
}
