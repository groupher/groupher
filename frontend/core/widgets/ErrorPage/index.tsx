/*
 *
 * ErrorPage
 *
 */

import type { FC } from 'react'
import METRIC from '~/const/metric'
import type { TMetric } from '~/spec'

import useSalon from './salon'

export type TProps = {
  errorCode?: number // 400 | 500 | 404
  target?: string
  testid?: string
  metric?: TMetric
}

const ErrorPage: FC<TProps> = ({
  _testid = 'error-page',
  _errorCode = 500,
  _metric = METRIC.COMMUNITY,
  _target = '',
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <h3>this is error page, make me pretty</h3>
    </div>
  )
}
export default ErrorPage
