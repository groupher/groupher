import type { TPagedChangelogs, TResState } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

type TRes = {
  resState: TResState
  pagedChangelogs: TPagedChangelogs
}

export default (): TRes => {
  const { pagedChangelogs, resState } = useSubStore('articles')

  return {
    resState,
    pagedChangelogs,
  }
}
