/*
 * ArticleReadLabel
 */

import type { FC } from 'react'
import dynamic from 'next/dynamic'

import type { TSpace } from '~/spec'
// import RealLabel from './RealLabel'

const RealLabel = dynamic(() => import('./RealLabel'), {
  ssr: false,
})

export type TProps = {
  viewed?: boolean
  size?: number
} & TSpace

const ArticleReadLabel: FC<TProps> = (props) => {
  return <RealLabel {...props} />
}

export default ArticleReadLabel
