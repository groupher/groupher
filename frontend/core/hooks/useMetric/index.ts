'use client'

import { useContext } from 'react'

import type { TMetric } from '~/spec'
import { ShellStyleContext } from '~/stores/shellStyle/context'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  const value = useContext(ShellStyleContext)
  if (!value) throw new Error('useMetric must be used within ShellStyleProvider')

  const { metric } = value

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
