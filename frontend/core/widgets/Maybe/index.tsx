/*
 * Maybe
 */

import { isEmpty } from 'ramda'
import { type FC, memo, type ReactNode } from 'react'

const MaybeLoading = ({ loading }) => {
  if (isEmpty(loading)) return <div />
  return <div>{loading}</div>
}

type TProps = {
  children: ReactNode
  test: boolean
  loading?: boolean
}

const Maybe: FC<TProps> = ({ children, test, loading = false }) => {
  if (Array.isArray(test) && isEmpty(test)) {
    return <MaybeLoading loading={loading} />
  }

  if (test === null) return <div />
  if (test === false) return <MaybeLoading loading={loading} />

  return <>{children}</>
}

export default memo(Maybe)
