'use client'

/*
 * ArticleReadLabel
 */

import type { FC } from 'react'
import useDidMount from '~/hooks/useDidMount'
import type { TSpace } from '~/spec'
import useAccount from '~/stores/account/hooks'

import useSalon from './salon'

export type TProps = {
  viewed?: boolean
  size?: number
} & TSpace

const ArticleReadLabel: FC<TProps> = ({ viewed, size = 1.5, ...spacing }) => {
  const spacing$ = { top: 0.5, right: 2, ...spacing }
  const s = useSalon({ size, ...spacing$ })
  const mounted = useDidMount()

  const { isLogin, loading } = useAccount()

  // Wait until account hydration settles before rendering login-sensitive
  // markers. This avoids SSR/CSR mismatches right after auth cookie sync.
  if (!mounted || loading) return null

  if (!isLogin) return null

  if (!viewed) {
    return <div className={s.wrapper} />
  }

  return null
}

export default ArticleReadLabel
