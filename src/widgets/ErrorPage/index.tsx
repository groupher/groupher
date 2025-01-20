/*
 *
 * ErrorPage
 *
 */

import type { FC } from 'react'

import type { TMetric } from '~/spec'
import METRIC from '~/const/metric'

import useSalon from './salon'

export type TProps = {
  errorCode?: number // 400 | 500 | 404
  target?: string
  testid?: string
  metric?: TMetric
}

const ErrorPage: FC<TProps> = ({
  testid = 'error-page',
  errorCode = 500,
  metric = METRIC.COMMUNITY,
  target = '',
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <h3>this is error page, make me pretty</h3>
    </div>
  )
}
export default ErrorPage
