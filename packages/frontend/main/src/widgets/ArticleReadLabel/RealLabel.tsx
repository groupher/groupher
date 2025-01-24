/*
 * ArticleReadLabel
 */

import type { FC } from 'react'

import type { TSpace } from '~/spec'
import useAccount from '~/hooks/useAccount'

import useSalon from './salon'

export type TProps = {
  viewed?: boolean
  size?: number
} & TSpace

const ReadLabel: FC<TProps> = ({ viewed, size = 1.5, ...spacing }) => {
  const spacing$ = { top: 0.5, right: 2, ...spacing }
  const s = useSalon({ size, ...spacing$ })

  const { isLogin } = useAccount()

  if (!isLogin) return null

  if (!viewed) {
    return <div className={s.wrapper} />
  }

  return null
}

export default ReadLabel
