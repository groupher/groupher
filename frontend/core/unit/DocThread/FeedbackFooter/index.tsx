/*
 *
 * FeedbackFooter
 *
 */

import type { FC } from 'react'

import type { TSpace } from '~/spec'

import BottomInfo from './BottomInfo'
import useSalon from './salon'
import TopInfo from './TopInfo'

type TProps = {
  offsetRight?: number
} & TSpace

const FeedbackFooter: FC<TProps> = ({ offsetRight = 8, ...spacing }) => {
  const s = useSalon({ ...spacing })

  return (
    <div className={s.wrapper}>
      <TopInfo />
      <BottomInfo offsetRight={offsetRight} />
    </div>
  )
}

export default FeedbackFooter
