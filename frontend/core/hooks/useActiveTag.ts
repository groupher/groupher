import useGeneral from '~/hooks/useGeneral'
import type { TTag } from '~/spec'

export default (): TTag => {
  const store = useGeneral()

  // @ts-expect-error
  return store.activeTag
}
